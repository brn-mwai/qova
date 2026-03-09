"""
Qova LangChain/LangGraph Integration.

Tools, toolkit, and callback handler for integrating Qova's AI agent
credit bureau with LangChain and LangGraph applications.

Usage:

    from qova_langchain import QovaToolkit

    toolkit = QovaToolkit()
    tools = toolkit.get_tools()

    # Use with LangGraph
    from langgraph.prebuilt import create_react_agent
    agent = create_react_agent(model, tools)

    # Auto-report agent actions via callback
    from qova_langchain import QovaCallbackHandler
    handler = QovaCallbackHandler(agent_address="0x...")
"""

from qova_langchain.callbacks import QovaCallbackHandler
from qova_langchain.client import QovaClient
from qova_langchain.toolkit import QovaToolkit
from qova_langchain.tools import (
    QovaBudgetCheckTool,
    QovaBudgetSetTool,
    QovaComputeScoreTool,
    QovaRecordTransactionTool,
    QovaRegisterAgentTool,
    QovaScoreLookupTool,
)
from qova_langchain.types import (
    BudgetCheckInput,
    BudgetCheckResponse,
    BudgetSetInput,
    BudgetSetResponse,
    BudgetStatusResponse,
    ComputeScoreInput,
    ComputeScoreResponse,
    QovaError,
    RecordTransactionInput,
    RecordTransactionResponse,
    RegisterAgentInput,
    RegisterAgentResponse,
    ScoreBreakdownResponse,
    ScoreFactor,
    ScoreLookupInput,
    TransactionType,
)

__all__ = [
    # Tools
    "QovaScoreLookupTool",
    "QovaRegisterAgentTool",
    "QovaRecordTransactionTool",
    "QovaBudgetCheckTool",
    "QovaBudgetSetTool",
    "QovaComputeScoreTool",
    # Toolkit
    "QovaToolkit",
    # Client
    "QovaClient",
    # Callbacks
    "QovaCallbackHandler",
    # Types
    "ScoreLookupInput",
    "RegisterAgentInput",
    "RecordTransactionInput",
    "BudgetCheckInput",
    "BudgetSetInput",
    "ComputeScoreInput",
    "ScoreBreakdownResponse",
    "ScoreFactor",
    "RegisterAgentResponse",
    "RecordTransactionResponse",
    "BudgetCheckResponse",
    "BudgetSetResponse",
    "BudgetStatusResponse",
    "ComputeScoreResponse",
    "TransactionType",
    "QovaError",
]

__version__ = "0.1.0"
