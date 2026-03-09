"""
Unit tests for qova_langchain tools with mocked HTTP.

Uses respx to mock httpx requests (both sync and async).
"""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from qova_langchain.client import QovaClient
from qova_langchain.tools import (
    QovaBudgetCheckTool,
    QovaBudgetSetTool,
    QovaComputeScoreTool,
    QovaRecordTransactionTool,
    QovaRegisterAgentTool,
    QovaScoreLookupTool,
)
from qova_langchain.toolkit import QovaToolkit
from qova_langchain.callbacks import QovaCallbackHandler, _infer_tx_type, _extract_amount
from qova_langchain.types import TransactionType

BASE_URL = "https://test.qova.cc"
AGENT_ADDR = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"
TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"


@pytest.fixture
def client() -> QovaClient:
    return QovaClient(base_url=BASE_URL, api_key="test-key")


# ---------------------------------------------------------------------------
# Score Lookup
# ---------------------------------------------------------------------------


class TestScoreLookupTool:
    @respx.mock
    def test_score_lookup_success(self, client: QovaClient) -> None:
        response_data = {
            "agent": AGENT_ADDR,
            "score": 750,
            "grade": "AA",
            "gradeColor": "#22C55E",
            "factors": {
                "transactionVolume": {
                    "raw": "1.5 USDC.e",
                    "normalized": 0.456,
                    "weight": 0.25,
                    "contribution": 114,
                },
                "transactionCount": {
                    "raw": 42,
                    "normalized": 0.042,
                    "weight": 0.20,
                    "contribution": 8,
                },
                "successRate": {
                    "raw": "95.00%",
                    "normalized": 0.95,
                    "weight": 0.25,
                    "contribution": 238,
                },
                "budgetCompliance": {
                    "raw": "60% utilized",
                    "normalized": 1.0,
                    "weight": 0.15,
                    "contribution": 150,
                },
                "accountAge": {
                    "raw": "30 days",
                    "normalized": 0.082,
                    "weight": 0.15,
                    "contribution": 12,
                },
            },
            "timestamp": "2026-03-09T12:00:00.000Z",
        }
        respx.get(f"{BASE_URL}/api/scores/{AGENT_ADDR}").mock(
            return_value=httpx.Response(200, json=response_data)
        )

        tool = QovaScoreLookupTool(client=client)
        result = tool._run(address=AGENT_ADDR)
        parsed = json.loads(result)

        assert parsed["score"] == 750
        assert parsed["grade"] == "AA"
        assert "transactionVolume" in parsed["factors"]

    @respx.mock
    def test_score_lookup_not_found(self, client: QovaClient) -> None:
        respx.get(f"{BASE_URL}/api/scores/{AGENT_ADDR}").mock(
            return_value=httpx.Response(
                404, json={"error": "Agent not found"}
            )
        )

        tool = QovaScoreLookupTool(client=client)
        result = tool._run(address=AGENT_ADDR)
        parsed = json.loads(result)

        assert parsed["error"] is True
        assert parsed["status_code"] == 404

    @respx.mock
    @pytest.mark.asyncio
    async def test_score_lookup_async(self, client: QovaClient) -> None:
        response_data = {
            "agent": AGENT_ADDR,
            "score": 600,
            "grade": "A",
            "gradeColor": "#FACC15",
            "factors": {},
            "timestamp": "2026-03-09T12:00:00.000Z",
        }
        respx.get(f"{BASE_URL}/api/scores/{AGENT_ADDR}").mock(
            return_value=httpx.Response(200, json=response_data)
        )

        tool = QovaScoreLookupTool(client=client)
        result = await tool._arun(address=AGENT_ADDR)
        parsed = json.loads(result)

        assert parsed["score"] == 600


# ---------------------------------------------------------------------------
# Register Agent
# ---------------------------------------------------------------------------


class TestRegisterAgentTool:
    @respx.mock
    def test_register_success(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/agents/register").mock(
            return_value=httpx.Response(
                201, json={"txHash": TX_HASH, "agent": AGENT_ADDR}
            )
        )

        tool = QovaRegisterAgentTool(client=client)
        result = tool._run(address=AGENT_ADDR)
        parsed = json.loads(result)

        assert parsed["txHash"] == TX_HASH
        assert parsed["agent"] == AGENT_ADDR

    @respx.mock
    def test_register_already_exists(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/agents/register").mock(
            return_value=httpx.Response(
                400, json={"error": "Agent already registered"}
            )
        )

        tool = QovaRegisterAgentTool(client=client)
        result = tool._run(address=AGENT_ADDR)
        parsed = json.loads(result)

        assert parsed["error"] is True
        assert parsed["status_code"] == 400


# ---------------------------------------------------------------------------
# Record Transaction
# ---------------------------------------------------------------------------


class TestRecordTransactionTool:
    @respx.mock
    def test_record_success(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/transactions/record").mock(
            return_value=httpx.Response(
                201, json={"txHash": TX_HASH, "agent": AGENT_ADDR}
            )
        )

        tool = QovaRecordTransactionTool(client=client)
        result = tool._run(
            agent=AGENT_ADDR,
            txHash=TX_HASH,
            amount="1000000000000000000",
            txType=0,
        )
        parsed = json.loads(result)

        assert parsed["txHash"] == TX_HASH

    @respx.mock
    @pytest.mark.asyncio
    async def test_record_async(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/transactions/record").mock(
            return_value=httpx.Response(
                201, json={"txHash": TX_HASH, "agent": AGENT_ADDR}
            )
        )

        tool = QovaRecordTransactionTool(client=client)
        result = await tool._arun(
            agent=AGENT_ADDR,
            txHash=TX_HASH,
            amount="500000000000000000",
            txType=1,
        )
        parsed = json.loads(result)

        assert parsed["agent"] == AGENT_ADDR


# ---------------------------------------------------------------------------
# Budget Check
# ---------------------------------------------------------------------------


class TestBudgetCheckTool:
    @respx.mock
    def test_budget_within(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/budgets/{AGENT_ADDR}/check").mock(
            return_value=httpx.Response(
                200,
                json={
                    "agent": AGENT_ADDR,
                    "withinBudget": True,
                    "amount": "1000000000000000000",
                },
            )
        )

        tool = QovaBudgetCheckTool(client=client)
        result = tool._run(agent=AGENT_ADDR, amount="1000000000000000000")
        parsed = json.loads(result)

        assert parsed["withinBudget"] is True

    @respx.mock
    def test_budget_exceeded(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/budgets/{AGENT_ADDR}/check").mock(
            return_value=httpx.Response(
                200,
                json={
                    "agent": AGENT_ADDR,
                    "withinBudget": False,
                    "amount": "999000000000000000000",
                },
            )
        )

        tool = QovaBudgetCheckTool(client=client)
        result = tool._run(agent=AGENT_ADDR, amount="999000000000000000000")
        parsed = json.loads(result)

        assert parsed["withinBudget"] is False


# ---------------------------------------------------------------------------
# Budget Set
# ---------------------------------------------------------------------------


class TestBudgetSetTool:
    @respx.mock
    def test_set_budget(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/budgets/{AGENT_ADDR}/set").mock(
            return_value=httpx.Response(
                200, json={"txHash": TX_HASH, "agent": AGENT_ADDR}
            )
        )

        tool = QovaBudgetSetTool(client=client)
        result = tool._run(
            agent=AGENT_ADDR,
            dailyLimit="10000000000000000000",
            monthlyLimit="300000000000000000000",
            perTxLimit="1000000000000000000",
        )
        parsed = json.loads(result)

        assert parsed["txHash"] == TX_HASH


# ---------------------------------------------------------------------------
# Compute Score
# ---------------------------------------------------------------------------


class TestComputeScoreTool:
    @respx.mock
    def test_compute_score(self, client: QovaClient) -> None:
        respx.post(f"{BASE_URL}/api/scores/compute").mock(
            return_value=httpx.Response(
                200,
                json={"score": 820, "grade": "AAA", "gradeColor": "#22C55E"},
            )
        )

        tool = QovaComputeScoreTool(client=client)
        result = tool._run(
            totalVolume="50000000000000000000",
            transactionCount=500,
            successRate=9800,
            dailySpent="1000000000000000000",
            dailyLimit="10000000000000000000",
            accountAgeSeconds=86400 * 180,
        )
        parsed = json.loads(result)

        assert parsed["score"] == 820
        assert parsed["grade"] == "AAA"


# ---------------------------------------------------------------------------
# Toolkit
# ---------------------------------------------------------------------------


class TestQovaToolkit:
    def test_get_all_tools(self, client: QovaClient) -> None:
        toolkit = QovaToolkit(client=client)
        tools = toolkit.get_tools()

        assert len(tools) == 6
        names = {t.name for t in tools}
        assert "qova_score_lookup" in names
        assert "qova_register_agent" in names
        assert "qova_record_transaction" in names
        assert "qova_budget_check" in names
        assert "qova_budget_set" in names
        assert "qova_compute_score" in names

    def test_include_filter(self, client: QovaClient) -> None:
        toolkit = QovaToolkit(
            client=client,
            include=["qova_score_lookup", "qova_budget_check"],
        )
        tools = toolkit.get_tools()

        assert len(tools) == 2
        names = {t.name for t in tools}
        assert names == {"qova_score_lookup", "qova_budget_check"}

    def test_exclude_filter(self, client: QovaClient) -> None:
        toolkit = QovaToolkit(
            client=client,
            exclude=["qova_register_agent", "qova_budget_set"],
        )
        tools = toolkit.get_tools()

        assert len(tools) == 4
        names = {t.name for t in tools}
        assert "qova_register_agent" not in names
        assert "qova_budget_set" not in names

    def test_tools_share_client(self, client: QovaClient) -> None:
        toolkit = QovaToolkit(client=client)
        tools = toolkit.get_tools()

        for tool in tools:
            assert tool.client is client  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Callback Handler Utilities
# ---------------------------------------------------------------------------


class TestCallbackHelpers:
    def test_infer_tx_type_swap(self) -> None:
        assert _infer_tx_type("uniswap") == TransactionType.SWAP
        assert _infer_tx_type("my_dex_swap_tool") == TransactionType.SWAP

    def test_infer_tx_type_bridge(self) -> None:
        assert _infer_tx_type("wormhole_bridge") == TransactionType.BRIDGE
        assert _infer_tx_type("cross_chain_relay") == TransactionType.BRIDGE

    def test_infer_tx_type_transfer(self) -> None:
        assert _infer_tx_type("send_tokens") == TransactionType.TRANSFER

    def test_infer_tx_type_payment(self) -> None:
        assert _infer_tx_type("x402_payment") == TransactionType.PAYMENT
        assert _infer_tx_type("invoice_payment") == TransactionType.PAYMENT

    def test_infer_tx_type_default(self) -> None:
        assert _infer_tx_type("random_tool") == TransactionType.CONTRACT_CALL

    def test_extract_amount_from_json(self) -> None:
        tool_input = json.dumps({"amount": "1000000"})
        assert _extract_amount(tool_input, "") == "1000000"

    def test_extract_amount_from_output(self) -> None:
        assert _extract_amount("", json.dumps({"value": 500})) == "500"

    def test_extract_amount_fallback(self) -> None:
        assert _extract_amount("not json", "also not json") == "0"


# ---------------------------------------------------------------------------
# Callback Handler
# ---------------------------------------------------------------------------


class TestQovaCallbackHandler:
    def test_should_track_normal_tool(self) -> None:
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=QovaClient(base_url=BASE_URL, api_key="test-key"),
        )
        assert handler._should_track("swap") is True
        assert handler._should_track("transfer_tokens") is True

    def test_should_not_track_qova_tools(self) -> None:
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=QovaClient(base_url=BASE_URL, api_key="test-key"),
        )
        assert handler._should_track("qova_score_lookup") is False
        assert handler._should_track("qova_record_transaction") is False

    def test_should_not_track_ignored_tools(self) -> None:
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=QovaClient(base_url=BASE_URL, api_key="test-key"),
            ignore_tools=["internal_tool"],
        )
        assert handler._should_track("internal_tool") is False
        assert handler._should_track("other_tool") is True

    def test_track_only_listed_tools(self) -> None:
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=QovaClient(base_url=BASE_URL, api_key="test-key"),
            track_tools=["swap", "bridge"],
        )
        assert handler._should_track("swap") is True
        assert handler._should_track("bridge") is True
        assert handler._should_track("transfer") is False

    def test_metrics_initial(self) -> None:
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=QovaClient(base_url=BASE_URL, api_key="test-key"),
        )
        metrics = handler.get_metrics()
        assert metrics["total_recorded"] == 0
        assert metrics["total_errors"] == 0
        assert metrics["budget_violations"] == 0

    @respx.mock
    @pytest.mark.asyncio
    async def test_on_tool_end_records(self) -> None:
        from uuid import uuid4

        client = QovaClient(base_url=BASE_URL, api_key="test")
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=client,
            auto_budget_check=False,
        )

        respx.post(f"{BASE_URL}/api/transactions/record").mock(
            return_value=httpx.Response(
                201, json={"txHash": TX_HASH, "agent": AGENT_ADDR}
            )
        )

        await handler.on_tool_end(
            output='{"result": "success"}',
            run_id=uuid4(),
            name="swap",
            inputs={"amount": "1000"},
        )

        assert handler.total_recorded == 1
        assert handler.total_errors == 0

    @respx.mock
    @pytest.mark.asyncio
    async def test_on_tool_end_skips_qova_tools(self) -> None:
        from uuid import uuid4

        client = QovaClient(base_url=BASE_URL, api_key="test")
        handler = QovaCallbackHandler(
            agent_address=AGENT_ADDR,
            client=client,
        )

        # Should NOT make any HTTP calls
        await handler.on_tool_end(
            output="{}",
            run_id=uuid4(),
            name="qova_score_lookup",
        )

        assert handler.total_recorded == 0


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class TestQovaClient:
    def test_default_config(self) -> None:
        client = QovaClient(api_key="test-key")
        assert client.base_url == "https://api.qova.cc"
        assert client.timeout == 30.0

    def test_custom_config(self) -> None:
        client = QovaClient(
            base_url="https://custom.qova.cc",
            api_key="my-key",
            timeout=10.0,
        )
        assert client.base_url == "https://custom.qova.cc"
        assert not hasattr(client, "api_key")
        assert client.timeout == 10.0
        assert client._headers["Authorization"] == "Bearer my-key"

    def test_url_trailing_slash_stripped(self) -> None:
        client = QovaClient(base_url="https://api.qova.cc/", api_key="test-key")
        assert client.base_url == "https://api.qova.cc"

    @respx.mock
    def test_server_error_handling(self) -> None:
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score").mock(
            return_value=httpx.Response(500, json={"error": "Internal server error"})
        )

        client = QovaClient(base_url=BASE_URL, api_key="test-key")
        result = client.get_score(AGENT_ADDR)

        from qova_langchain.types import QovaError
        assert isinstance(result, QovaError)
        assert result.status_code == 500
