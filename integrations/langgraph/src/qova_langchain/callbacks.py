"""
LangChain callback handler that auto-records agent actions to Qova.

This is the killer feature of the integration: drop in the callback handler
and every tool call your LangChain/LangGraph agent makes is automatically
reported to the Qova credit bureau as a transaction, building the agent's
financial reputation without modifying any agent code.

Usage:

    from qova_langchain import QovaCallbackHandler

    handler = QovaCallbackHandler(agent_address="0x1234...")

    # With LangChain
    llm.invoke("...", config={"callbacks": [handler]})

    # With LangGraph
    agent.invoke({"messages": [...]}, config={"callbacks": [handler]})
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any, Optional, Sequence
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

from qova_langchain.client import QovaClient
from qova_langchain.types import QovaError, TransactionType

logger = logging.getLogger("qova_langchain.callbacks")

# Map well-known tool names to transaction types
_TOOL_TX_TYPE_MAP: dict[str, int] = {
    # DeFi / swap tools
    "swap": TransactionType.SWAP,
    "uniswap": TransactionType.SWAP,
    "sushiswap": TransactionType.SWAP,
    "1inch_swap": TransactionType.SWAP,
    "dex_swap": TransactionType.SWAP,
    # Transfer tools
    "transfer": TransactionType.TRANSFER,
    "send_tokens": TransactionType.TRANSFER,
    "send_eth": TransactionType.TRANSFER,
    "erc20_transfer": TransactionType.TRANSFER,
    # Bridge tools
    "bridge": TransactionType.BRIDGE,
    "cross_chain_bridge": TransactionType.BRIDGE,
    "wormhole_bridge": TransactionType.BRIDGE,
    "layerzero_bridge": TransactionType.BRIDGE,
    # Payment tools
    "pay": TransactionType.PAYMENT,
    "payment": TransactionType.PAYMENT,
    "x402_payment": TransactionType.PAYMENT,
    "invoice_payment": TransactionType.PAYMENT,
}


def _infer_tx_type(tool_name: str) -> int:
    """Infer the transaction type from a tool name using keyword matching."""
    name_lower = tool_name.lower()

    # Direct match
    if name_lower in _TOOL_TX_TYPE_MAP:
        return _TOOL_TX_TYPE_MAP[name_lower]

    # Keyword match
    if any(kw in name_lower for kw in ("swap", "dex", "exchange")):
        return TransactionType.SWAP
    if any(kw in name_lower for kw in ("bridge", "cross_chain")):
        return TransactionType.BRIDGE
    if any(kw in name_lower for kw in ("transfer", "send")):
        return TransactionType.TRANSFER
    if any(kw in name_lower for kw in ("pay", "invoice")):
        return TransactionType.PAYMENT

    # Default: contract call
    return TransactionType.CONTRACT_CALL


def _generate_pseudo_tx_hash(
    tool_name: str,
    tool_input: str,
    run_id: str,
) -> str:
    """Generate a deterministic pseudo transaction hash for non-blockchain tool calls."""
    content = f"{tool_name}:{tool_input}:{run_id}:{time.time_ns()}"
    digest = hashlib.sha256(content.encode()).hexdigest()
    return f"0x{digest}"


def _extract_amount(tool_input: str, tool_output: str) -> str:
    """Best-effort extraction of a financial amount from tool input/output.

    Falls back to "0" if no amount can be determined.
    """
    import json as _json

    # Try parsing tool_input as JSON and look for amount-like fields
    for source in (tool_input, tool_output):
        try:
            data = _json.loads(source)
            if isinstance(data, dict):
                for key in ("amount", "value", "total", "price", "cost", "wei"):
                    if key in data:
                        val = data[key]
                        if isinstance(val, (int, float)):
                            return str(int(val))
                        if isinstance(val, str) and val.isdigit():
                            return val
        except (ValueError, TypeError):
            pass

    return "0"


class QovaCallbackHandler(AsyncCallbackHandler):
    """LangChain callback handler that auto-reports agent actions to Qova.

    Every tool call the agent makes is recorded as a Qova transaction,
    building the agent's financial reputation automatically.

    Args:
        agent_address: The Ethereum address of the AI agent.
        client: Optional ``QovaClient``. Created from env vars if omitted.
        track_tools: Optional list of tool names to track. If provided,
            only these tools trigger Qova recordings. If ``None``, all
            tool calls are tracked.
        ignore_tools: Tool names to never track (e.g., internal tools).
            Qova's own tools are always excluded to prevent recursion.
        auto_budget_check: If ``True`` (default), automatically checks
            the agent's budget before recording a transaction.
        record_llm_calls: If ``True``, LLM invocations are also recorded
            as CONTRACT_CALL transactions. Default is ``False``.

    Example::

        handler = QovaCallbackHandler(
            agent_address="0x1234567890abcdef1234567890abcdef12345678",
            track_tools=["swap", "transfer", "bridge"],
        )
    """

    # Qova tool names to always ignore (prevent recursion)
    _QOVA_TOOLS = frozenset({
        "qova_score_lookup",
        "qova_register_agent",
        "qova_record_transaction",
        "qova_budget_check",
        "qova_budget_set",
        "qova_compute_score",
    })

    def __init__(
        self,
        agent_address: str,
        client: Optional[QovaClient] = None,
        track_tools: Optional[Sequence[str]] = None,
        ignore_tools: Optional[Sequence[str]] = None,
        auto_budget_check: bool = True,
        record_llm_calls: bool = False,
    ) -> None:
        super().__init__()
        self.agent_address = agent_address
        self.client = client or QovaClient()
        self.track_tools = set(track_tools) if track_tools else None
        self.ignore_tools = set(ignore_tools) if ignore_tools else set()
        self.auto_budget_check = auto_budget_check
        self.record_llm_calls = record_llm_calls

        # Metrics
        self.total_recorded: int = 0
        self.total_errors: int = 0
        self.budget_violations: int = 0

    @property
    def raise_error(self) -> bool:
        """Never raise - failures should not break the agent's execution."""
        return False

    def _should_track(self, tool_name: str) -> bool:
        """Decide whether to track this tool call."""
        # Never track Qova's own tools (recursion guard)
        if tool_name in self._QOVA_TOOLS:
            return False
        # Explicitly ignored
        if tool_name in self.ignore_tools:
            return False
        # If include-list is set, only track listed tools
        if self.track_tools is not None:
            return tool_name in self.track_tools
        return True

    async def on_tool_end(
        self,
        output: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        name: Optional[str] = None,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
        inputs: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool finishes. Records the action as a Qova transaction."""
        tool_name = name or "unknown_tool"
        if not self._should_track(tool_name):
            return

        tool_input = ""
        if inputs:
            import json as _json
            try:
                tool_input = _json.dumps(inputs)
            except (TypeError, ValueError):
                tool_input = str(inputs)

        tx_type = _infer_tx_type(tool_name)
        amount = _extract_amount(tool_input, output or "")
        pseudo_hash = _generate_pseudo_tx_hash(tool_name, tool_input, str(run_id))

        # Budget check (best-effort, non-blocking)
        if self.auto_budget_check and amount != "0":
            try:
                budget_result = await self.client.acheck_budget(self.agent_address, amount)
                if isinstance(budget_result, QovaError):
                    logger.warning(
                        "Qova budget check failed for %s: %s",
                        tool_name,
                        budget_result.message,
                    )
                elif not budget_result.withinBudget:
                    self.budget_violations += 1
                    logger.warning(
                        "Qova budget violation for tool %s: amount=%s exceeds budget",
                        tool_name,
                        amount,
                    )
            except Exception:
                logger.debug("Budget check skipped due to error", exc_info=True)

        # Record the transaction (best-effort, non-blocking)
        try:
            result = await self.client.arecord_transaction(
                agent=self.agent_address,
                tx_hash=pseudo_hash,
                amount=amount,
                tx_type=tx_type,
            )
            if isinstance(result, QovaError):
                self.total_errors += 1
                logger.warning(
                    "Failed to record Qova transaction for tool %s: %s",
                    tool_name,
                    result.message,
                )
            else:
                self.total_recorded += 1
                logger.debug(
                    "Recorded Qova transaction for tool %s: txHash=%s",
                    tool_name,
                    result.txHash,
                )
        except Exception:
            self.total_errors += 1
            logger.debug("Failed to record Qova transaction", exc_info=True)

    async def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Optionally record LLM calls as transactions."""
        if not self.record_llm_calls:
            return

        pseudo_hash = _generate_pseudo_tx_hash("llm_call", "", str(run_id))

        try:
            result = await self.client.arecord_transaction(
                agent=self.agent_address,
                tx_hash=pseudo_hash,
                amount="0",
                tx_type=TransactionType.CONTRACT_CALL,
            )
            if isinstance(result, QovaError):
                self.total_errors += 1
            else:
                self.total_recorded += 1
        except Exception:
            self.total_errors += 1
            logger.debug("Failed to record LLM call transaction", exc_info=True)

    def get_metrics(self) -> dict[str, int]:
        """Return callback handler metrics for observability."""
        return {
            "total_recorded": self.total_recorded,
            "total_errors": self.total_errors,
            "budget_violations": self.budget_violations,
        }
