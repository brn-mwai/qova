"""
Qova CrewAI integration.

Provides CrewAI tools for AI agents to interact with the Qova reputation
and credit scoring system. Tools call the Qova REST API at api.qova.cc.

Usage::

    from qova_crewai import get_qova_tools

    tools = get_qova_tools()
    agent = Agent(role="Financial Analyst", tools=tools, ...)

Or import individual tools::

    from qova_crewai import QovaScoreLookupTool, QovaBudgetCheckTool

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

from .client import QovaClient
from .tools import (
    ALL_TOOLS,
    QovaBudgetCheckTool,
    QovaComputeScoreTool,
    QovaRecordTransactionTool,
    QovaRegisterAgentTool,
    QovaScoreLookupTool,
    get_qova_tools,
)
from .types import (
    AgentDetails,
    AgentScore,
    BudgetCheckResult,
    BudgetConfig,
    BudgetStatus,
    BudgetUsage,
    BudgetUtilization,
    ComputedScore,
    QovaApiError,
    ScoreBreakdown,
    ScoreFactor,
    TransactionStats,
    TransactionType,
    WriteResult,
)

__version__ = "0.1.0"

__all__ = [
    # Tools
    "QovaScoreLookupTool",
    "QovaRegisterAgentTool",
    "QovaRecordTransactionTool",
    "QovaBudgetCheckTool",
    "QovaComputeScoreTool",
    "get_qova_tools",
    "ALL_TOOLS",
    # Client
    "QovaClient",
    # Types
    "AgentDetails",
    "AgentScore",
    "BudgetCheckResult",
    "BudgetConfig",
    "BudgetStatus",
    "BudgetUsage",
    "BudgetUtilization",
    "ComputedScore",
    "QovaApiError",
    "ScoreBreakdown",
    "ScoreFactor",
    "TransactionStats",
    "TransactionType",
    "WriteResult",
]
