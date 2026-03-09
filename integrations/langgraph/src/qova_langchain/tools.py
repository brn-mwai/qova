"""
LangChain tools for the Qova credit bureau API.

Each tool extends ``langchain_core.tools.BaseTool`` and provides both
synchronous ``_run()`` and asynchronous ``_arun()`` methods. All tools
communicate with the Qova REST API via the ``QovaClient``.
"""

from __future__ import annotations

import json
from typing import Any, Optional, Type

from langchain_core.callbacks import (
    AsyncCallbackManagerForToolRun,
    CallbackManagerForToolRun,
)
from langchain_core.tools import BaseTool
from pydantic import BaseModel

from qova_langchain.client import QovaClient
from qova_langchain.types import (
    BudgetCheckInput,
    BudgetSetInput,
    ComputeScoreInput,
    QovaError,
    RecordTransactionInput,
    RegisterAgentInput,
    ScoreLookupInput,
)


def _format_result(result: BaseModel | QovaError) -> str:
    """Serialize a Qova response model to a JSON string for LLM consumption."""
    if isinstance(result, QovaError):
        return json.dumps(
            {
                "error": True,
                "status_code": result.status_code,
                "message": result.message,
                "detail": result.detail,
            }
        )
    return result.model_dump_json()


class QovaScoreLookupTool(BaseTool):
    """Look up an AI agent's reputation score on the Qova credit bureau.

    Returns the full score breakdown including individual factors
    (transaction volume, count, success rate, budget compliance, account age),
    the overall grade (AAA to D), and grade color.
    """

    name: str = "qova_score_lookup"
    description: str = (
        "Look up an AI agent's financial reputation score from the Qova credit bureau. "
        "Provide the agent's Ethereum address (0x-prefixed, 42 characters). "
        "Returns the score (0-1000), grade (AAA/AA/A/BBB/BB/B/CCC/CC/C/D), "
        "and a breakdown of contributing factors: transaction volume, "
        "transaction count, success rate, budget compliance, and account age."
    )
    args_schema: Type[BaseModel] = ScoreLookupInput
    return_direct: bool = False

    client: QovaClient = None  # type: ignore[assignment]

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, client: Optional[QovaClient] = None, **kwargs: Any) -> None:
        super().__init__(client=client or QovaClient(), **kwargs)

    def _run(
        self,
        address: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        result = self.client.get_score_breakdown(address)
        return _format_result(result)

    async def _arun(
        self,
        address: str,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        result = await self.client.aget_score_breakdown(address)
        return _format_result(result)


class QovaRegisterAgentTool(BaseTool):
    """Register a new AI agent on the Qova credit bureau (on-chain).

    This creates an on-chain record for the agent, initializing its
    reputation score and enabling transaction tracking.
    """

    name: str = "qova_register_agent"
    description: str = (
        "Register a new AI agent on the Qova on-chain credit bureau. "
        "Provide the agent's Ethereum address (0x-prefixed, 42 characters). "
        "This must be called before recording transactions or checking scores "
        "for a new agent. Returns the registration transaction hash."
    )
    args_schema: Type[BaseModel] = RegisterAgentInput
    return_direct: bool = False

    client: QovaClient = None  # type: ignore[assignment]

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, client: Optional[QovaClient] = None, **kwargs: Any) -> None:
        super().__init__(client=client or QovaClient(), **kwargs)

    def _run(
        self,
        address: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        result = self.client.register_agent(address)
        return _format_result(result)

    async def _arun(
        self,
        address: str,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        result = await self.client.aregister_agent(address)
        return _format_result(result)


class QovaRecordTransactionTool(BaseTool):
    """Record a financial transaction for an AI agent on the Qova credit bureau.

    Transaction types: PAYMENT (0), SWAP (1), TRANSFER (2),
    CONTRACT_CALL (3), BRIDGE (4).
    """

    name: str = "qova_record_transaction"
    description: str = (
        "Record a financial transaction for an AI agent on the Qova credit bureau. "
        "This updates the agent's reputation score based on the transaction. "
        "Required fields: agent (Ethereum address), txHash (transaction hash), "
        "amount (in wei as string), txType (0=PAYMENT, 1=SWAP, 2=TRANSFER, "
        "3=CONTRACT_CALL, 4=BRIDGE). Returns the recording transaction hash."
    )
    args_schema: Type[BaseModel] = RecordTransactionInput
    return_direct: bool = False

    client: QovaClient = None  # type: ignore[assignment]

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, client: Optional[QovaClient] = None, **kwargs: Any) -> None:
        super().__init__(client=client or QovaClient(), **kwargs)

    def _run(
        self,
        agent: str,
        txHash: str,
        amount: str,
        txType: int,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        result = self.client.record_transaction(agent, txHash, amount, txType)
        return _format_result(result)

    async def _arun(
        self,
        agent: str,
        txHash: str,
        amount: str,
        txType: int,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        result = await self.client.arecord_transaction(agent, txHash, amount, txType)
        return _format_result(result)


class QovaBudgetCheckTool(BaseTool):
    """Check whether a spending amount is within an AI agent's budget limits.

    Use this before executing a financial action to ensure compliance
    with the agent's configured spending limits.
    """

    name: str = "qova_budget_check"
    description: str = (
        "Check if a spending amount is within an AI agent's budget limits on Qova. "
        "Provide the agent's Ethereum address and the amount in wei (as string). "
        "Returns whether the spend is within budget (withinBudget: true/false). "
        "Always call this BEFORE executing financial transactions to prevent "
        "budget violations that damage the agent's reputation score."
    )
    args_schema: Type[BaseModel] = BudgetCheckInput
    return_direct: bool = False

    client: QovaClient = None  # type: ignore[assignment]

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, client: Optional[QovaClient] = None, **kwargs: Any) -> None:
        super().__init__(client=client or QovaClient(), **kwargs)

    def _run(
        self,
        agent: str,
        amount: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        result = self.client.check_budget(agent, amount)
        return _format_result(result)

    async def _arun(
        self,
        agent: str,
        amount: str,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        result = await self.client.acheck_budget(agent, amount)
        return _format_result(result)


class QovaBudgetSetTool(BaseTool):
    """Set budget limits for an AI agent on the Qova credit bureau.

    Configures daily, monthly, and per-transaction spending limits.
    Budget compliance is a factor in the agent's reputation score.
    """

    name: str = "qova_budget_set"
    description: str = (
        "Set spending budget limits for an AI agent on the Qova credit bureau. "
        "Provide the agent's Ethereum address and three limits in wei (as strings): "
        "dailyLimit, monthlyLimit, and perTxLimit. Budget compliance contributes "
        "to the agent's reputation score - agents that stay within budget "
        "receive higher scores."
    )
    args_schema: Type[BaseModel] = BudgetSetInput
    return_direct: bool = False

    client: QovaClient = None  # type: ignore[assignment]

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, client: Optional[QovaClient] = None, **kwargs: Any) -> None:
        super().__init__(client=client or QovaClient(), **kwargs)

    def _run(
        self,
        agent: str,
        dailyLimit: str,
        monthlyLimit: str,
        perTxLimit: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        result = self.client.set_budget(agent, dailyLimit, monthlyLimit, perTxLimit)
        return _format_result(result)

    async def _arun(
        self,
        agent: str,
        dailyLimit: str,
        monthlyLimit: str,
        perTxLimit: str,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        result = await self.client.aset_budget(agent, dailyLimit, monthlyLimit, perTxLimit)
        return _format_result(result)


class QovaComputeScoreTool(BaseTool):
    """Compute a reputation score from raw metrics without recording on-chain.

    This is a stateless computation useful for "what-if" scenarios
    or previewing how metrics would affect a score.
    """

    name: str = "qova_compute_score"
    description: str = (
        "Compute a hypothetical Qova reputation score from raw metrics without "
        "recording anything on-chain. Useful for simulations and 'what-if' analysis. "
        "Required: totalVolume (wei string), transactionCount (int), "
        "successRate (basis points 0-10000), dailySpent (wei string), "
        "dailyLimit (wei string), accountAgeSeconds (int). "
        "Optional: sanctionsClean (bool), apiReputationScore (0-100). "
        "Returns computed score (0-1000), grade, and grade color."
    )
    args_schema: Type[BaseModel] = ComputeScoreInput
    return_direct: bool = False

    client: QovaClient = None  # type: ignore[assignment]

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, client: Optional[QovaClient] = None, **kwargs: Any) -> None:
        super().__init__(client=client or QovaClient(), **kwargs)

    def _run(
        self,
        totalVolume: str,
        transactionCount: int,
        successRate: int,
        dailySpent: str,
        dailyLimit: str,
        accountAgeSeconds: int,
        sanctionsClean: bool = True,
        apiReputationScore: Optional[int] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        metrics: dict[str, Any] = {
            "totalVolume": totalVolume,
            "transactionCount": transactionCount,
            "successRate": successRate,
            "dailySpent": dailySpent,
            "dailyLimit": dailyLimit,
            "accountAgeSeconds": accountAgeSeconds,
            "sanctionsClean": sanctionsClean,
        }
        if apiReputationScore is not None:
            metrics["apiReputationScore"] = apiReputationScore
        result = self.client.compute_score(metrics)
        return _format_result(result)

    async def _arun(
        self,
        totalVolume: str,
        transactionCount: int,
        successRate: int,
        dailySpent: str,
        dailyLimit: str,
        accountAgeSeconds: int,
        sanctionsClean: bool = True,
        apiReputationScore: Optional[int] = None,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        metrics: dict[str, Any] = {
            "totalVolume": totalVolume,
            "transactionCount": transactionCount,
            "successRate": successRate,
            "dailySpent": dailySpent,
            "dailyLimit": dailyLimit,
            "accountAgeSeconds": accountAgeSeconds,
            "sanctionsClean": sanctionsClean,
        }
        if apiReputationScore is not None:
            metrics["apiReputationScore"] = apiReputationScore
        result = await self.client.acompute_score(metrics)
        return _format_result(result)
