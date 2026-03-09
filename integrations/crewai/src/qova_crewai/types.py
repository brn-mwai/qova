"""
Qova API response types.

Typed dataclasses and enums for all Qova REST API responses used by
the CrewAI tools. These mirror the response schemas defined in the
Qova API (api.qova.cc).

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class TransactionType(IntEnum):
    """On-chain transaction type codes."""

    PAYMENT = 0
    SWAP = 1
    TRANSFER = 2
    CONTRACT_CALL = 3
    BRIDGE = 4


@dataclass(frozen=True, slots=True)
class ScoreFactor:
    """A single factor contributing to the overall reputation score."""

    raw: str | int | float
    normalized: float
    weight: float
    contribution: int


@dataclass(frozen=True, slots=True)
class ScoreBreakdown:
    """Full score breakdown with individual factor contributions."""

    agent: str
    score: int
    grade: str
    grade_color: str
    factors: dict[str, ScoreFactor]
    timestamp: str


@dataclass(frozen=True, slots=True)
class AgentScore:
    """Agent score summary returned by GET /api/agents/:address/score."""

    agent: str
    score: int
    grade: str
    grade_color: str
    score_formatted: str
    score_percentage: float


@dataclass(frozen=True, slots=True)
class AgentDetails:
    """Enriched agent details returned by GET /api/agents/:address."""

    agent: str
    score: int
    grade: str
    grade_color: str
    score_formatted: str
    score_percentage: float
    last_updated: str
    update_count: int
    is_registered: bool
    address_short: str
    explorer_url: str


@dataclass(frozen=True, slots=True)
class TransactionStats:
    """Transaction statistics returned by GET /api/transactions/:address/stats."""

    agent: str
    total_count: int
    total_volume: str
    total_volume_wei: str
    success_rate: str
    success_rate_bps: int
    last_activity: str
    address_short: str


@dataclass(frozen=True, slots=True)
class BudgetConfig:
    """Budget limit configuration."""

    daily_limit: str
    monthly_limit: str
    per_tx_limit: str


@dataclass(frozen=True, slots=True)
class BudgetUsage:
    """Current budget usage."""

    daily_spent: str
    monthly_spent: str
    daily_remaining: str
    monthly_remaining: str


@dataclass(frozen=True, slots=True)
class BudgetUtilization:
    """Budget utilization percentages."""

    daily: str
    monthly: str


@dataclass(frozen=True, slots=True)
class BudgetStatus:
    """Full budget status returned by GET /api/budgets/:address."""

    agent: str
    config: BudgetConfig
    usage: BudgetUsage
    utilization: BudgetUtilization
    raw: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class BudgetCheckResult:
    """Result of a budget check from POST /api/budgets/:address/check."""

    agent: str
    within_budget: bool
    amount: str


@dataclass(frozen=True, slots=True)
class ComputedScore:
    """Result of stateless score computation from POST /api/scores/compute."""

    score: int
    grade: str
    grade_color: str


@dataclass(frozen=True, slots=True)
class WriteResult:
    """Result of a write operation (register, record transaction, etc.)."""

    tx_hash: str
    agent: str


class QovaApiError(Exception):
    """Error returned by the Qova REST API."""

    def __init__(self, status_code: int, message: str, url: str) -> None:
        self.status_code = status_code
        self.message = message
        self.url = url
        super().__init__(f"Qova API error {status_code} at {url}: {message}")
