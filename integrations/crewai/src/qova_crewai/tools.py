"""
CrewAI tools for Qova reputation and credit scoring.

Each tool wraps a Qova REST API endpoint, providing AI agents with the
ability to look up reputation scores, register agents, record transactions,
check budgets, and compute scores from raw metrics.

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

import re
from dataclasses import asdict
from typing import Any, Type

from crewai_tools import BaseTool
from pydantic import BaseModel, Field

from .client import QovaClient
from .types import QovaApiError, TransactionType

# ---------------------------------------------------------------------------
# Shared validation
# ---------------------------------------------------------------------------

_ETH_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_HEX_RE = re.compile(r"^0x[a-fA-F0-9]+$")


def _validate_address(address: str) -> str | None:
    """Return an error message if the address is invalid, else None."""
    if not _ETH_ADDRESS_RE.match(address):
        return (
            f"Invalid Ethereum address: {address!r}. "
            "Must be a 0x-prefixed 40-character hex string."
        )
    return None


def _format_result(data: dict[str, Any]) -> str:
    """Format a result dict into a human-readable string for the LLM."""
    lines: list[str] = []
    for key, value in data.items():
        if isinstance(value, dict):
            lines.append(f"{key}:")
            for sub_key, sub_value in value.items():
                lines.append(f"  {sub_key}: {sub_value}")
        else:
            lines.append(f"{key}: {value}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool: Score Lookup
# ---------------------------------------------------------------------------


class ScoreLookupInput(BaseModel):
    """Input for looking up an agent's reputation score."""

    agent_address: str = Field(
        ...,
        description=(
            "The Ethereum address (0x-prefixed, 40 hex chars) of the AI agent "
            "whose reputation score you want to look up."
        ),
    )
    include_breakdown: bool = Field(
        default=False,
        description=(
            "If true, returns a detailed breakdown of all score factors "
            "(transaction volume, count, success rate, budget compliance, "
            "account age) with their individual contributions. If false, "
            "returns only the overall score and grade."
        ),
    )


class QovaScoreLookupTool(BaseTool):
    """Look up an AI agent's Qova reputation score, grade, and breakdown.

    Use this tool to assess the financial trustworthiness of an AI agent
    before transacting with it. The score ranges from 0 to 1000 (higher is
    better). Grades: AAA (900+), AA (800-899), A (700-799), BBB (600-699),
    BB (500-599), B (400-499), CCC (300-399), CC (200-299), C (100-199),
    D (0-99).
    """

    name: str = "qova_score_lookup"
    description: str = (
        "Look up an AI agent's Qova reputation score and credit grade. "
        "Returns the score (0-1000), letter grade (AAA to D), and optionally "
        "a detailed breakdown of contributing factors like transaction volume, "
        "success rate, budget compliance, and account age. Use this to assess "
        "whether an agent is trustworthy before executing financial operations."
    )
    args_schema: Type[BaseModel] = ScoreLookupInput
    qova_client: QovaClient | None = None

    model_config = {"arbitrary_types_allowed": True}

    def _get_client(self) -> QovaClient:
        if self.qova_client is None:
            self.qova_client = QovaClient()
        return self.qova_client

    def _run(self, agent_address: str, include_breakdown: bool = False) -> str:
        error = _validate_address(agent_address)
        if error:
            return f"Error: {error}"

        client = self._get_client()
        try:
            if include_breakdown:
                breakdown = client.get_score_breakdown(agent_address)
                result: dict[str, Any] = {
                    "agent": breakdown.agent,
                    "score": breakdown.score,
                    "grade": breakdown.grade,
                    "grade_color": breakdown.grade_color,
                    "timestamp": breakdown.timestamp,
                }
                factors_dict: dict[str, Any] = {}
                for factor_name, factor in breakdown.factors.items():
                    factors_dict[factor_name] = {
                        "raw": factor.raw,
                        "normalized": factor.normalized,
                        "weight": factor.weight,
                        "contribution": factor.contribution,
                    }
                result["factors"] = factors_dict
                return _format_result(result)
            else:
                score = client.get_agent_score(agent_address)
                return _format_result(asdict(score))

        except QovaApiError as exc:
            return f"Error looking up score for {agent_address}: {exc.message} (HTTP {exc.status_code})"


# ---------------------------------------------------------------------------
# Tool: Register Agent
# ---------------------------------------------------------------------------


class RegisterAgentInput(BaseModel):
    """Input for registering a new agent on-chain."""

    agent_address: str = Field(
        ...,
        description=(
            "The Ethereum address (0x-prefixed, 40 hex chars) of the AI agent "
            "to register in the Qova reputation system."
        ),
    )


class QovaRegisterAgentTool(BaseTool):
    """Register a new AI agent in the Qova on-chain reputation system.

    This is a write operation that submits a blockchain transaction. The agent
    must not already be registered. After registration, the agent starts with
    a default score and can begin building its reputation through transactions.
    """

    name: str = "qova_register_agent"
    description: str = (
        "Register a new AI agent on the Qova blockchain reputation system. "
        "This creates an on-chain identity for the agent so it can start "
        "building a reputation score through financial transactions. Returns "
        "the transaction hash of the registration. The agent must not already "
        "be registered."
    )
    args_schema: Type[BaseModel] = RegisterAgentInput
    qova_client: QovaClient | None = None

    model_config = {"arbitrary_types_allowed": True}

    def _get_client(self) -> QovaClient:
        if self.qova_client is None:
            self.qova_client = QovaClient()
        return self.qova_client

    def _run(self, agent_address: str) -> str:
        error = _validate_address(agent_address)
        if error:
            return f"Error: {error}"

        client = self._get_client()
        try:
            # Check if already registered
            if client.is_agent_registered(agent_address):
                return f"Agent {agent_address} is already registered in the Qova system."

            result = client.register_agent(agent_address)
            return (
                f"Successfully registered agent {result.agent}.\n"
                f"Transaction hash: {result.tx_hash}"
            )

        except QovaApiError as exc:
            return f"Error registering agent {agent_address}: {exc.message} (HTTP {exc.status_code})"


# ---------------------------------------------------------------------------
# Tool: Record Transaction
# ---------------------------------------------------------------------------


class RecordTransactionInput(BaseModel):
    """Input for recording an agent transaction."""

    agent_address: str = Field(
        ...,
        description=(
            "The Ethereum address (0x-prefixed, 40 hex chars) of the AI agent "
            "that performed the transaction."
        ),
    )
    tx_hash: str = Field(
        ...,
        description=(
            "The transaction hash (0x-prefixed hex string) of the on-chain "
            "transaction to record."
        ),
    )
    amount: str = Field(
        ...,
        description=(
            "The transaction amount in wei (as a string to preserve precision). "
            "For example, '1000000' for 1 USDC (6 decimals)."
        ),
    )
    tx_type: int = Field(
        default=0,
        description=(
            "Transaction type code: 0=PAYMENT, 1=SWAP, 2=TRANSFER, "
            "3=CONTRACT_CALL, 4=BRIDGE. Defaults to 0 (PAYMENT)."
        ),
        ge=0,
        le=4,
    )


class QovaRecordTransactionTool(BaseTool):
    """Record a financial transaction for an AI agent in the Qova system.

    Recording transactions is how agents build their reputation. Each
    transaction is logged on-chain and contributes to the agent's score
    through factors like volume, count, and success rate.
    """

    name: str = "qova_record_transaction"
    description: str = (
        "Record a financial transaction for an AI agent in the Qova reputation "
        "system. This logs the transaction on-chain and updates the agent's "
        "reputation factors (volume, count, success rate). Provide the agent "
        "address, transaction hash, amount in wei, and transaction type "
        "(0=PAYMENT, 1=SWAP, 2=TRANSFER, 3=CONTRACT_CALL, 4=BRIDGE). "
        "Returns the recording transaction hash."
    )
    args_schema: Type[BaseModel] = RecordTransactionInput
    qova_client: QovaClient | None = None

    model_config = {"arbitrary_types_allowed": True}

    def _get_client(self) -> QovaClient:
        if self.qova_client is None:
            self.qova_client = QovaClient()
        return self.qova_client

    def _run(
        self, agent_address: str, tx_hash: str, amount: str, tx_type: int = 0
    ) -> str:
        error = _validate_address(agent_address)
        if error:
            return f"Error: {error}"

        if not _HEX_RE.match(tx_hash):
            return f"Error: Invalid transaction hash: {tx_hash!r}. Must be a 0x-prefixed hex string."

        if tx_type not in {t.value for t in TransactionType}:
            return f"Error: Invalid transaction type: {tx_type}. Must be 0-4."

        client = self._get_client()
        try:
            type_name = TransactionType(tx_type).name
            result = client.record_transaction(agent_address, tx_hash, amount, tx_type)
            return (
                f"Transaction recorded for agent {result.agent}.\n"
                f"Type: {type_name}\n"
                f"Amount: {amount} wei\n"
                f"Recording tx hash: {result.tx_hash}"
            )
        except QovaApiError as exc:
            return (
                f"Error recording transaction for {agent_address}: "
                f"{exc.message} (HTTP {exc.status_code})"
            )


# ---------------------------------------------------------------------------
# Tool: Budget Check
# ---------------------------------------------------------------------------


class BudgetCheckInput(BaseModel):
    """Input for checking an agent's budget."""

    agent_address: str = Field(
        ...,
        description=(
            "The Ethereum address (0x-prefixed, 40 hex chars) of the AI agent "
            "whose budget to check."
        ),
    )
    amount: str = Field(
        ...,
        description=(
            "The amount in wei (as a string) to check against the agent's "
            "budget limits. For example, '1000000' for 1 USDC (6 decimals)."
        ),
    )


class QovaBudgetCheckTool(BaseTool):
    """Check if a proposed spend is within an AI agent's budget limits.

    Use this tool before executing a transaction to verify the agent has
    sufficient budget remaining. The Qova budget system tracks daily,
    monthly, and per-transaction limits on-chain.
    """

    name: str = "qova_budget_check"
    description: str = (
        "Check whether a proposed spending amount is within an AI agent's "
        "on-chain budget limits. Returns whether the spend is allowed, along "
        "with the agent's current budget status including daily/monthly limits, "
        "amounts spent, and remaining allowances. Use this BEFORE executing "
        "a financial transaction to prevent budget violations."
    )
    args_schema: Type[BaseModel] = BudgetCheckInput
    qova_client: QovaClient | None = None

    model_config = {"arbitrary_types_allowed": True}

    def _get_client(self) -> QovaClient:
        if self.qova_client is None:
            self.qova_client = QovaClient()
        return self.qova_client

    def _run(self, agent_address: str, amount: str) -> str:
        error = _validate_address(agent_address)
        if error:
            return f"Error: {error}"

        client = self._get_client()
        try:
            check = client.check_budget(agent_address, amount)
            budget = client.get_budget_status(agent_address)

            status = "WITHIN BUDGET" if check.within_budget else "EXCEEDS BUDGET"
            lines = [
                f"Budget check for agent {check.agent}: {status}",
                f"Requested amount: {check.amount} wei",
                "",
                "Current budget status:",
                f"  Daily limit: {budget.config.daily_limit}",
                f"  Daily spent: {budget.usage.daily_spent}",
                f"  Daily remaining: {budget.usage.daily_remaining}",
                f"  Daily utilization: {budget.utilization.daily}",
                "",
                f"  Monthly limit: {budget.config.monthly_limit}",
                f"  Monthly spent: {budget.usage.monthly_spent}",
                f"  Monthly remaining: {budget.usage.monthly_remaining}",
                f"  Monthly utilization: {budget.utilization.monthly}",
                "",
                f"  Per-transaction limit: {budget.config.per_tx_limit}",
            ]
            return "\n".join(lines)

        except QovaApiError as exc:
            return (
                f"Error checking budget for {agent_address}: "
                f"{exc.message} (HTTP {exc.status_code})"
            )


# ---------------------------------------------------------------------------
# Tool: Compute Score
# ---------------------------------------------------------------------------


class ComputeScoreInput(BaseModel):
    """Input for computing a reputation score from raw metrics."""

    total_volume: str = Field(
        ...,
        description="Total transaction volume in wei (string). Example: '1000000000000000000' for 1 ETH.",
    )
    transaction_count: int = Field(
        ...,
        description="Total number of transactions the agent has completed.",
        ge=0,
    )
    success_rate: int = Field(
        ...,
        description=(
            "Transaction success rate in basis points (0-10000). "
            "10000 = 100% success, 5000 = 50% success, etc."
        ),
        ge=0,
        le=10000,
    )
    daily_spent: str = Field(
        ...,
        description="Amount spent today in wei (string).",
    )
    daily_limit: str = Field(
        ...,
        description="Daily budget limit in wei (string).",
    )
    account_age_seconds: int = Field(
        ...,
        description="Age of the agent's account in seconds.",
        ge=0,
    )
    sanctions_clean: bool = Field(
        default=True,
        description="Whether the agent is clear of sanctions (default: true).",
    )
    api_reputation_score: int | None = Field(
        default=None,
        description="Optional external reputation score from 0 to 100.",
        ge=0,
        le=100,
    )


class QovaComputeScoreTool(BaseTool):
    """Compute a Qova reputation score from raw metrics without on-chain reads.

    This is a stateless computation - it does not read any on-chain data or
    require the agent to be registered. Useful for simulating what an agent's
    score would be given hypothetical metrics, or for computing scores from
    off-chain data sources.
    """

    name: str = "qova_compute_score"
    description: str = (
        "Compute a Qova reputation score from raw metrics without reading "
        "on-chain data. Provide transaction volume, count, success rate, "
        "budget usage, and account age to get a score (0-1000) and grade. "
        "This is stateless and useful for simulating scores, evaluating "
        "hypothetical scenarios, or computing scores from off-chain data. "
        "Does NOT require the agent to be registered."
    )
    args_schema: Type[BaseModel] = ComputeScoreInput
    qova_client: QovaClient | None = None

    model_config = {"arbitrary_types_allowed": True}

    def _get_client(self) -> QovaClient:
        if self.qova_client is None:
            self.qova_client = QovaClient()
        return self.qova_client

    def _run(
        self,
        total_volume: str,
        transaction_count: int,
        success_rate: int,
        daily_spent: str,
        daily_limit: str,
        account_age_seconds: int,
        sanctions_clean: bool = True,
        api_reputation_score: int | None = None,
    ) -> str:
        client = self._get_client()
        try:
            result = client.compute_score(
                total_volume=total_volume,
                transaction_count=transaction_count,
                success_rate=success_rate,
                daily_spent=daily_spent,
                daily_limit=daily_limit,
                account_age_seconds=account_age_seconds,
                sanctions_clean=sanctions_clean,
                api_reputation_score=api_reputation_score,
            )

            account_age_days = account_age_seconds // 86400
            lines = [
                f"Computed Qova Score: {result.score}/1000",
                f"Grade: {result.grade}",
                f"Grade color: {result.grade_color}",
                "",
                "Input metrics:",
                f"  Total volume: {total_volume} wei",
                f"  Transaction count: {transaction_count}",
                f"  Success rate: {success_rate / 100:.1f}%",
                f"  Daily spent: {daily_spent} wei",
                f"  Daily limit: {daily_limit} wei",
                f"  Account age: {account_age_days} days ({account_age_seconds}s)",
                f"  Sanctions clean: {sanctions_clean}",
            ]
            if api_reputation_score is not None:
                lines.append(f"  External reputation: {api_reputation_score}/100")

            return "\n".join(lines)

        except QovaApiError as exc:
            return f"Error computing score: {exc.message} (HTTP {exc.status_code})"


# ---------------------------------------------------------------------------
# Convenience: all tools
# ---------------------------------------------------------------------------

ALL_TOOLS = [
    QovaScoreLookupTool,
    QovaRegisterAgentTool,
    QovaRecordTransactionTool,
    QovaBudgetCheckTool,
    QovaComputeScoreTool,
]


def get_qova_tools(
    base_url: str | None = None,
    api_key: str | None = None,
) -> list[BaseTool]:
    """Create instances of all Qova tools with a shared client.

    Args:
        base_url: Override the Qova API base URL.
        api_key: Override the Qova API key.

    Returns:
        A list of initialized CrewAI tool instances ready for use.
    """
    client = QovaClient(base_url=base_url, api_key=api_key)
    return [
        QovaScoreLookupTool(qova_client=client),
        QovaRegisterAgentTool(qova_client=client),
        QovaRecordTransactionTool(qova_client=client),
        QovaBudgetCheckTool(qova_client=client),
        QovaComputeScoreTool(qova_client=client),
    ]
