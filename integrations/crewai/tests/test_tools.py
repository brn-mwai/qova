"""
Tests for Qova CrewAI tools.

Uses respx to mock httpx requests so no real API calls are made.
All tests verify tool behavior with realistic Qova API response shapes.

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

import httpx
import pytest
import respx

from qova_crewai.client import QovaClient
from qova_crewai.tools import (
    QovaBudgetCheckTool,
    QovaComputeScoreTool,
    QovaRecordTransactionTool,
    QovaRegisterAgentTool,
    QovaScoreLookupTool,
    get_qova_tools,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_BASE_URL = "https://api.qova.cc"
TEST_AGENT = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"
INVALID_AGENT = "0xinvalid"

AGENT_SCORE_RESPONSE = {
    "agent": TEST_AGENT,
    "score": 742,
    "grade": "A",
    "gradeColor": "#22C55E",
    "scoreFormatted": "742 / 1000",
    "scorePercentage": 74.2,
}

AGENT_DETAILS_RESPONSE = {
    **AGENT_SCORE_RESPONSE,
    "lastUpdated": "2026-03-09T12:00:00.000Z",
    "updateCount": 15,
    "isRegistered": True,
    "addressShort": "0x0a3A...1158",
    "explorerUrl": f"https://sepolia.basescan.org/address/{TEST_AGENT}",
}

SCORE_BREAKDOWN_RESPONSE = {
    "agent": TEST_AGENT,
    "score": 742,
    "grade": "A",
    "gradeColor": "#22C55E",
    "factors": {
        "transactionVolume": {
            "raw": "1.5 USDC.e",
            "normalized": 0.456,
            "weight": 0.25,
            "contribution": 114,
        },
        "transactionCount": {
            "raw": 47,
            "normalized": 0.047,
            "weight": 0.20,
            "contribution": 9,
        },
        "successRate": {
            "raw": "95.74%",
            "normalized": 0.957,
            "weight": 0.25,
            "contribution": 239,
        },
        "budgetCompliance": {
            "raw": "62% utilized",
            "normalized": 1.0,
            "weight": 0.15,
            "contribution": 150,
        },
        "accountAge": {
            "raw": "84 days",
            "normalized": 0.230,
            "weight": 0.15,
            "contribution": 34,
        },
    },
    "timestamp": "2026-03-09T12:00:00.000Z",
}

BUDGET_STATUS_RESPONSE = {
    "agent": TEST_AGENT,
    "config": {
        "dailyLimit": "100.0 USDC.e",
        "monthlyLimit": "2000.0 USDC.e",
        "perTxLimit": "50.0 USDC.e",
    },
    "usage": {
        "dailySpent": "35.0 USDC.e",
        "monthlySpent": "450.0 USDC.e",
        "dailyRemaining": "65.0 USDC.e",
        "monthlyRemaining": "1550.0 USDC.e",
    },
    "utilization": {
        "daily": "35.00%",
        "monthly": "22.50%",
    },
    "raw": {
        "dailyLimit": "100000000",
        "monthlyLimit": "2000000000",
        "perTxLimit": "50000000",
        "dailySpent": "35000000",
        "monthlySpent": "450000000",
        "dailyRemaining": "65000000",
        "monthlyRemaining": "1550000000",
    },
}

BUDGET_CHECK_RESPONSE = {
    "agent": TEST_AGENT,
    "withinBudget": True,
    "amount": "10000000",
}

COMPUTE_SCORE_RESPONSE = {
    "score": 680,
    "grade": "BBB",
    "gradeColor": "#FACC15",
}

REGISTER_RESPONSE = {
    "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "agent": TEST_AGENT,
}

RECORD_TX_RESPONSE = {
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "agent": TEST_AGENT,
}

REGISTERED_RESPONSE = {
    "agent": TEST_AGENT,
    "isRegistered": False,
}


@pytest.fixture
def client() -> QovaClient:
    return QovaClient(base_url=TEST_BASE_URL, api_key="test-key")


# ---------------------------------------------------------------------------
# Score Lookup Tool
# ---------------------------------------------------------------------------


class TestQovaScoreLookupTool:
    """Tests for QovaScoreLookupTool."""

    @respx.mock
    def test_basic_score_lookup(self, client: QovaClient) -> None:
        respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}/score").mock(
            return_value=httpx.Response(200, json=AGENT_SCORE_RESPONSE)
        )

        tool = QovaScoreLookupTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT)

        assert "742" in result
        assert "A" in result
        assert TEST_AGENT in result

    @respx.mock
    def test_score_lookup_with_breakdown(self, client: QovaClient) -> None:
        respx.get(f"{TEST_BASE_URL}/api/scores/{TEST_AGENT}").mock(
            return_value=httpx.Response(200, json=SCORE_BREAKDOWN_RESPONSE)
        )

        tool = QovaScoreLookupTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT, include_breakdown=True)

        assert "742" in result
        assert "transactionVolume" in result
        assert "successRate" in result
        assert "budgetCompliance" in result
        assert "accountAge" in result

    def test_invalid_address(self, client: QovaClient) -> None:
        tool = QovaScoreLookupTool(qova_client=client)
        result = tool._run(agent_address=INVALID_AGENT)

        assert "Error" in result
        assert "Invalid Ethereum address" in result

    @respx.mock
    def test_api_error_handling(self, client: QovaClient) -> None:
        respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}/score").mock(
            return_value=httpx.Response(
                404, json={"error": "Agent not found"}
            )
        )

        tool = QovaScoreLookupTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT)

        assert "Error" in result
        assert "404" in result


# ---------------------------------------------------------------------------
# Register Agent Tool
# ---------------------------------------------------------------------------


class TestQovaRegisterAgentTool:
    """Tests for QovaRegisterAgentTool."""

    @respx.mock
    def test_register_new_agent(self, client: QovaClient) -> None:
        respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}/registered").mock(
            return_value=httpx.Response(200, json=REGISTERED_RESPONSE)
        )
        respx.post(f"{TEST_BASE_URL}/api/agents/register").mock(
            return_value=httpx.Response(201, json=REGISTER_RESPONSE)
        )

        tool = QovaRegisterAgentTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT)

        assert "Successfully registered" in result
        assert REGISTER_RESPONSE["txHash"] in result

    @respx.mock
    def test_already_registered(self, client: QovaClient) -> None:
        respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}/registered").mock(
            return_value=httpx.Response(
                200, json={"agent": TEST_AGENT, "isRegistered": True}
            )
        )

        tool = QovaRegisterAgentTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT)

        assert "already registered" in result

    def test_invalid_address(self, client: QovaClient) -> None:
        tool = QovaRegisterAgentTool(qova_client=client)
        result = tool._run(agent_address="not-an-address")

        assert "Error" in result
        assert "Invalid Ethereum address" in result


# ---------------------------------------------------------------------------
# Record Transaction Tool
# ---------------------------------------------------------------------------


class TestQovaRecordTransactionTool:
    """Tests for QovaRecordTransactionTool."""

    @respx.mock
    def test_record_payment(self, client: QovaClient) -> None:
        respx.post(f"{TEST_BASE_URL}/api/transactions/record").mock(
            return_value=httpx.Response(201, json=RECORD_TX_RESPONSE)
        )

        tool = QovaRecordTransactionTool(qova_client=client)
        result = tool._run(
            agent_address=TEST_AGENT,
            tx_hash="0xabc123",
            amount="1000000",
            tx_type=0,
        )

        assert "Transaction recorded" in result
        assert "PAYMENT" in result
        assert "1000000" in result
        assert RECORD_TX_RESPONSE["txHash"] in result

    @respx.mock
    def test_record_swap(self, client: QovaClient) -> None:
        respx.post(f"{TEST_BASE_URL}/api/transactions/record").mock(
            return_value=httpx.Response(201, json=RECORD_TX_RESPONSE)
        )

        tool = QovaRecordTransactionTool(qova_client=client)
        result = tool._run(
            agent_address=TEST_AGENT,
            tx_hash="0xdef456",
            amount="5000000",
            tx_type=1,
        )

        assert "SWAP" in result

    def test_invalid_tx_hash(self, client: QovaClient) -> None:
        tool = QovaRecordTransactionTool(qova_client=client)
        result = tool._run(
            agent_address=TEST_AGENT,
            tx_hash="not-hex",
            amount="1000000",
        )

        assert "Error" in result
        assert "Invalid transaction hash" in result

    def test_invalid_tx_type(self, client: QovaClient) -> None:
        tool = QovaRecordTransactionTool(qova_client=client)
        result = tool._run(
            agent_address=TEST_AGENT,
            tx_hash="0xabc123",
            amount="1000000",
            tx_type=9,
        )

        assert "Error" in result
        assert "Invalid transaction type" in result


# ---------------------------------------------------------------------------
# Budget Check Tool
# ---------------------------------------------------------------------------


class TestQovaBudgetCheckTool:
    """Tests for QovaBudgetCheckTool."""

    @respx.mock
    def test_within_budget(self, client: QovaClient) -> None:
        respx.post(f"{TEST_BASE_URL}/api/budgets/{TEST_AGENT}/check").mock(
            return_value=httpx.Response(200, json=BUDGET_CHECK_RESPONSE)
        )
        respx.get(f"{TEST_BASE_URL}/api/budgets/{TEST_AGENT}").mock(
            return_value=httpx.Response(200, json=BUDGET_STATUS_RESPONSE)
        )

        tool = QovaBudgetCheckTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT, amount="10000000")

        assert "WITHIN BUDGET" in result
        assert "Daily limit" in result
        assert "Monthly limit" in result
        assert "Per-transaction limit" in result

    @respx.mock
    def test_exceeds_budget(self, client: QovaClient) -> None:
        exceeded_response = {
            **BUDGET_CHECK_RESPONSE,
            "withinBudget": False,
        }
        respx.post(f"{TEST_BASE_URL}/api/budgets/{TEST_AGENT}/check").mock(
            return_value=httpx.Response(200, json=exceeded_response)
        )
        respx.get(f"{TEST_BASE_URL}/api/budgets/{TEST_AGENT}").mock(
            return_value=httpx.Response(200, json=BUDGET_STATUS_RESPONSE)
        )

        tool = QovaBudgetCheckTool(qova_client=client)
        result = tool._run(agent_address=TEST_AGENT, amount="200000000")

        assert "EXCEEDS BUDGET" in result

    def test_invalid_address(self, client: QovaClient) -> None:
        tool = QovaBudgetCheckTool(qova_client=client)
        result = tool._run(agent_address="bad", amount="100")

        assert "Error" in result
        assert "Invalid Ethereum address" in result


# ---------------------------------------------------------------------------
# Compute Score Tool
# ---------------------------------------------------------------------------


class TestQovaComputeScoreTool:
    """Tests for QovaComputeScoreTool."""

    @respx.mock
    def test_compute_score(self, client: QovaClient) -> None:
        respx.post(f"{TEST_BASE_URL}/api/scores/compute").mock(
            return_value=httpx.Response(200, json=COMPUTE_SCORE_RESPONSE)
        )

        tool = QovaComputeScoreTool(qova_client=client)
        result = tool._run(
            total_volume="1500000000000000000",
            transaction_count=47,
            success_rate=9574,
            daily_spent="35000000",
            daily_limit="100000000",
            account_age_seconds=7257600,
        )

        assert "680" in result
        assert "BBB" in result
        assert "47" in result
        assert "95.7%" in result

    @respx.mock
    def test_compute_score_with_external_reputation(self, client: QovaClient) -> None:
        respx.post(f"{TEST_BASE_URL}/api/scores/compute").mock(
            return_value=httpx.Response(200, json=COMPUTE_SCORE_RESPONSE)
        )

        tool = QovaComputeScoreTool(qova_client=client)
        result = tool._run(
            total_volume="1000000",
            transaction_count=10,
            success_rate=10000,
            daily_spent="0",
            daily_limit="100000000",
            account_age_seconds=86400,
            api_reputation_score=85,
        )

        assert "External reputation: 85/100" in result

    @respx.mock
    def test_compute_score_api_error(self, client: QovaClient) -> None:
        respx.post(f"{TEST_BASE_URL}/api/scores/compute").mock(
            return_value=httpx.Response(400, json={"error": "Invalid success rate"})
        )

        tool = QovaComputeScoreTool(qova_client=client)
        result = tool._run(
            total_volume="0",
            transaction_count=0,
            success_rate=0,
            daily_spent="0",
            daily_limit="0",
            account_age_seconds=0,
        )

        assert "Error" in result
        assert "400" in result


# ---------------------------------------------------------------------------
# get_qova_tools helper
# ---------------------------------------------------------------------------


class TestGetQovaTools:
    """Tests for the get_qova_tools convenience function."""

    def test_returns_all_tools(self) -> None:
        tools = get_qova_tools(
            base_url="https://test.qova.cc",
            api_key="test-key",
        )

        assert len(tools) == 5

        names = {t.name for t in tools}
        assert names == {
            "qova_score_lookup",
            "qova_register_agent",
            "qova_record_transaction",
            "qova_budget_check",
            "qova_compute_score",
        }

    def test_shared_client(self) -> None:
        tools = get_qova_tools(
            base_url="https://test.qova.cc",
            api_key="shared-key",
        )

        clients = {id(t.qova_client) for t in tools}
        assert len(clients) == 1, "All tools should share the same client instance"


# ---------------------------------------------------------------------------
# Client tests
# ---------------------------------------------------------------------------


class TestQovaClient:
    """Tests for the QovaClient HTTP wrapper."""

    @respx.mock
    def test_timeout_handling(self) -> None:
        respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}").mock(
            side_effect=httpx.ReadTimeout("timed out")
        )

        client = QovaClient(base_url=TEST_BASE_URL, timeout=1.0)
        with pytest.raises(Exception) as exc_info:
            client.get_agent_details(TEST_AGENT)

        assert "timed out" in str(exc_info.value).lower() or "408" in str(exc_info.value)

    @respx.mock
    def test_api_error_propagation(self) -> None:
        respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}").mock(
            return_value=httpx.Response(
                429, json={"error": "Rate limit exceeded"}
            )
        )

        client = QovaClient(base_url=TEST_BASE_URL)
        with pytest.raises(Exception) as exc_info:
            client.get_agent_details(TEST_AGENT)

        err = exc_info.value
        assert "429" in str(err)

    def test_context_manager(self) -> None:
        with QovaClient(base_url=TEST_BASE_URL) as client:
            assert client.base_url == TEST_BASE_URL
        assert client._client is None or client._client.is_closed

    @respx.mock
    def test_auth_header_sent(self) -> None:
        route = respx.get(f"{TEST_BASE_URL}/api/agents/{TEST_AGENT}/registered").mock(
            return_value=httpx.Response(
                200, json={"agent": TEST_AGENT, "isRegistered": True}
            )
        )

        client = QovaClient(base_url=TEST_BASE_URL, api_key="my-secret-key")
        client.is_agent_registered(TEST_AGENT)

        assert route.called
        req = route.calls[0].request
        assert req.headers["authorization"] == "Bearer my-secret-key"

    @respx.mock
    def test_compute_score(self) -> None:
        respx.post(f"{TEST_BASE_URL}/api/scores/compute").mock(
            return_value=httpx.Response(200, json=COMPUTE_SCORE_RESPONSE)
        )

        client = QovaClient(base_url=TEST_BASE_URL)
        result = client.compute_score(
            total_volume="1000000",
            transaction_count=10,
            success_rate=9500,
            daily_spent="50000",
            daily_limit="100000",
            account_age_seconds=86400,
        )

        assert result.score == 680
        assert result.grade == "BBB"

    @respx.mock
    def test_check_budget(self) -> None:
        respx.post(f"{TEST_BASE_URL}/api/budgets/{TEST_AGENT}/check").mock(
            return_value=httpx.Response(200, json=BUDGET_CHECK_RESPONSE)
        )

        client = QovaClient(base_url=TEST_BASE_URL)
        result = client.check_budget(TEST_AGENT, "10000000")

        assert result.within_budget is True
        assert result.agent == TEST_AGENT

    @respx.mock
    def test_get_transaction_stats(self) -> None:
        tx_stats = {
            "agent": TEST_AGENT,
            "totalCount": 47,
            "totalVolume": "1.5 USDC.e",
            "totalVolumeWei": "1500000",
            "successRate": "95.74%",
            "successRateBps": 9574,
            "lastActivity": "2026-03-09T10:00:00.000Z",
            "addressShort": "0x0a3A...1158",
        }
        respx.get(f"{TEST_BASE_URL}/api/transactions/{TEST_AGENT}/stats").mock(
            return_value=httpx.Response(200, json=tx_stats)
        )

        client = QovaClient(base_url=TEST_BASE_URL)
        result = client.get_transaction_stats(TEST_AGENT)

        assert result.total_count == 47
        assert result.success_rate_bps == 9574

    @respx.mock
    def test_record_transaction(self) -> None:
        respx.post(f"{TEST_BASE_URL}/api/transactions/record").mock(
            return_value=httpx.Response(201, json=RECORD_TX_RESPONSE)
        )

        client = QovaClient(base_url=TEST_BASE_URL)
        result = client.record_transaction(
            agent=TEST_AGENT,
            tx_hash="0xabc123",
            amount="1000000",
            tx_type=0,
        )

        assert result.tx_hash == RECORD_TX_RESPONSE["txHash"]
        assert result.agent == TEST_AGENT
