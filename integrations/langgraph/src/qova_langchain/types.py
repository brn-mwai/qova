"""
Pydantic v2 models for Qova API request/response types.

All financial amounts are strings representing wei values (uint256).
Scores are integers 0-1000 (basis points where 1000 = 100%).
"""

from __future__ import annotations

from enum import IntEnum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class TransactionType(IntEnum):
    """On-chain transaction type enum (mirrors Solidity TransactionType)."""

    PAYMENT = 0
    SWAP = 1
    TRANSFER = 2
    CONTRACT_CALL = 3
    BRIDGE = 4


# ---------------------------------------------------------------------------
# Tool Input Schemas (args_schema for LangChain BaseTool)
# ---------------------------------------------------------------------------


class ScoreLookupInput(BaseModel):
    """Input for looking up an agent's reputation score."""

    address: str = Field(
        ...,
        description=(
            "The Ethereum address (0x-prefixed, 42 chars) of the AI agent "
            "whose reputation score to look up."
        ),
        pattern=r"^0x[a-fA-F0-9]{40}$",
    )


class RegisterAgentInput(BaseModel):
    """Input for registering a new AI agent on-chain."""

    address: str = Field(
        ...,
        description="The Ethereum address (0x-prefixed, 42 chars) of the AI agent to register.",
        pattern=r"^0x[a-fA-F0-9]{40}$",
    )


class RecordTransactionInput(BaseModel):
    """Input for recording a financial transaction for scoring."""

    agent: str = Field(
        ...,
        description="The Ethereum address of the AI agent that performed the transaction.",
        pattern=r"^0x[a-fA-F0-9]{40}$",
    )
    tx_hash: str = Field(
        ...,
        description="The transaction hash (0x-prefixed hex string).",
        pattern=r"^0x[a-fA-F0-9]+$",
        alias="txHash",
    )
    amount: str = Field(
        ...,
        description="Transaction amount in wei (as a string to preserve precision).",
    )
    tx_type: int = Field(
        ...,
        description=(
            "Transaction type: 0=PAYMENT, 1=SWAP, 2=TRANSFER, "
            "3=CONTRACT_CALL, 4=BRIDGE."
        ),
        ge=0,
        le=4,
        alias="txType",
    )

    model_config = {"populate_by_name": True}


class BudgetCheckInput(BaseModel):
    """Input for checking budget compliance before spending."""

    agent: str = Field(
        ...,
        description="The Ethereum address of the AI agent whose budget to check.",
        pattern=r"^0x[a-fA-F0-9]{40}$",
    )
    amount: str = Field(
        ...,
        description="The amount in wei to check against the agent's budget.",
    )


class BudgetSetInput(BaseModel):
    """Input for setting budget limits for an agent."""

    agent: str = Field(
        ...,
        description="The Ethereum address of the AI agent.",
        pattern=r"^0x[a-fA-F0-9]{40}$",
    )
    daily_limit: str = Field(
        ...,
        description="Daily spending limit in wei.",
        alias="dailyLimit",
    )
    monthly_limit: str = Field(
        ...,
        description="Monthly spending limit in wei.",
        alias="monthlyLimit",
    )
    per_tx_limit: str = Field(
        ...,
        description="Per-transaction spending limit in wei.",
        alias="perTxLimit",
    )

    model_config = {"populate_by_name": True}


class ComputeScoreInput(BaseModel):
    """Input for computing a reputation score from raw metrics (stateless)."""

    total_volume: str = Field(
        ...,
        description="Total transaction volume in wei.",
        alias="totalVolume",
    )
    transaction_count: int = Field(
        ...,
        description="Total number of transactions.",
        ge=0,
        alias="transactionCount",
    )
    success_rate: int = Field(
        ...,
        description="Success rate in basis points (0-10000, where 10000 = 100%).",
        ge=0,
        le=10000,
        alias="successRate",
    )
    daily_spent: str = Field(
        ...,
        description="Amount spent today in wei.",
        alias="dailySpent",
    )
    daily_limit: str = Field(
        ...,
        description="Daily spending limit in wei.",
        alias="dailyLimit",
    )
    account_age_seconds: int = Field(
        ...,
        description="Account age in seconds since registration.",
        ge=0,
        alias="accountAgeSeconds",
    )
    sanctions_clean: bool = Field(
        default=True,
        description="Whether the agent passes sanctions screening.",
        alias="sanctionsClean",
    )
    api_reputation_score: Optional[int] = Field(
        default=None,
        description="Optional external API reputation score (0-100).",
        ge=0,
        le=100,
        alias="apiReputationScore",
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# API Response Models
# ---------------------------------------------------------------------------


class ScoreFactor(BaseModel):
    """A single factor contributing to the reputation score."""

    raw: str | int | float
    normalized: float
    weight: float
    contribution: float


class ScoreBreakdownResponse(BaseModel):
    """Full score breakdown returned by GET /api/scores/:address."""

    agent: str
    score: int
    grade: str
    gradeColor: str
    factors: dict[str, ScoreFactor]
    timestamp: str


class RegisterAgentResponse(BaseModel):
    """Response from POST /api/agents/register."""

    txHash: str
    agent: str


class RecordTransactionResponse(BaseModel):
    """Response from POST /api/transactions/record."""

    txHash: str
    agent: str


class BudgetCheckResponse(BaseModel):
    """Response from POST /api/budgets/:address/check."""

    agent: str
    withinBudget: bool
    amount: str


class BudgetSetResponse(BaseModel):
    """Response from POST /api/budgets/:address/set."""

    txHash: str
    agent: str


class BudgetConfigInfo(BaseModel):
    """Budget configuration sub-object."""

    dailyLimit: str
    monthlyLimit: str
    perTxLimit: str


class BudgetUsageInfo(BaseModel):
    """Budget usage sub-object."""

    dailySpent: str
    monthlySpent: str
    dailyRemaining: str
    monthlyRemaining: str


class BudgetUtilizationInfo(BaseModel):
    """Budget utilization sub-object."""

    daily: str
    monthly: str


class BudgetStatusResponse(BaseModel):
    """Response from GET /api/budgets/:address."""

    agent: str
    config: BudgetConfigInfo
    usage: BudgetUsageInfo
    utilization: BudgetUtilizationInfo


class ComputeScoreResponse(BaseModel):
    """Response from POST /api/scores/compute."""

    score: int
    grade: str
    gradeColor: str


class AgentScoreResponse(BaseModel):
    """Response from GET /api/agents/:address/score."""

    agent: str
    score: int
    grade: str
    gradeColor: str
    scoreFormatted: str
    scorePercentage: float


# ---------------------------------------------------------------------------
# Error Model
# ---------------------------------------------------------------------------


class QovaError(BaseModel):
    """Structured error returned when a Qova API call fails."""

    status_code: int
    message: str
    detail: Optional[str] = None

    def __str__(self) -> str:
        base = f"QovaError({self.status_code}): {self.message}"
        if self.detail:
            base += f" - {self.detail}"
        return base
