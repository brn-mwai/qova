"""
QovaToolkit - LangChain convention for bundling related tools.

Usage:

    from qova_langchain import QovaToolkit

    toolkit = QovaToolkit()
    tools = toolkit.get_tools()

    # Pass to LangGraph agent
    from langgraph.prebuilt import create_react_agent
    agent = create_react_agent(model, tools)

    # Or selectively pick tools
    toolkit = QovaToolkit(include=["qova_score_lookup", "qova_budget_check"])
    tools = toolkit.get_tools()
"""

from __future__ import annotations

from typing import Optional, Sequence

from langchain_core.tools import BaseTool

from qova_langchain.client import QovaClient
from qova_langchain.tools import (
    QovaBudgetCheckTool,
    QovaBudgetSetTool,
    QovaComputeScoreTool,
    QovaRecordTransactionTool,
    QovaRegisterAgentTool,
    QovaScoreLookupTool,
)

_ALL_TOOL_CLASSES = [
    QovaScoreLookupTool,
    QovaRegisterAgentTool,
    QovaRecordTransactionTool,
    QovaBudgetCheckTool,
    QovaBudgetSetTool,
    QovaComputeScoreTool,
]


class QovaToolkit:
    """Bundle of all Qova LangChain tools sharing a single HTTP client.

    Args:
        client: Optional ``QovaClient`` instance. If not provided, one is
            created from environment variables (``QOVA_API_URL``,
            ``QOVA_API_KEY``).
        include: Optional list of tool names to include. If provided, only
            tools whose ``name`` is in this list are returned.
        exclude: Optional list of tool names to exclude.

    Example::

        toolkit = QovaToolkit()
        tools = toolkit.get_tools()
        # [QovaScoreLookupTool, QovaRegisterAgentTool, ...]

        # Read-only tools (no on-chain writes)
        toolkit = QovaToolkit(
            include=["qova_score_lookup", "qova_budget_check", "qova_compute_score"]
        )
    """

    def __init__(
        self,
        client: Optional[QovaClient] = None,
        include: Optional[Sequence[str]] = None,
        exclude: Optional[Sequence[str]] = None,
    ) -> None:
        self._client = client or QovaClient()
        self._include = set(include) if include else None
        self._exclude = set(exclude) if exclude else set()

    def get_tools(self) -> list[BaseTool]:
        """Return the list of Qova tools, filtered by include/exclude.

        All tools share the same underlying ``QovaClient`` instance
        for connection pooling and consistent configuration.
        """
        tools: list[BaseTool] = []
        for tool_cls in _ALL_TOOL_CLASSES:
            tool = tool_cls(client=self._client)
            if self._include is not None and tool.name not in self._include:
                continue
            if tool.name in self._exclude:
                continue
            tools.append(tool)
        return tools
