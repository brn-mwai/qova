"""
Unit tests for QovaClient security, error handling, and retry logic.

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

import os
from unittest.mock import patch

import httpx
import pytest
import respx

from qova_langchain.client import QovaClient
from qova_langchain.types import QovaAPIError, QovaRateLimitError, QovaTimeoutError

BASE_URL = "https://test.qova.cc"
AGENT_ADDR = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"


# ---------------------------------------------------------------------------
#  API Key validation
# ---------------------------------------------------------------------------


class TestApiKeyHandling:
    def test_missing_api_key_raises(self) -> None:
        """Client must raise ValueError when no API key is provided."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("QOVA_API_KEY", None)
            with pytest.raises(ValueError, match="QOVA_API_KEY required"):
                QovaClient(base_url=BASE_URL)

    def test_empty_api_key_raises(self) -> None:
        """Client must reject empty string as API key."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("QOVA_API_KEY", None)
            with pytest.raises(ValueError, match="QOVA_API_KEY required"):
                QovaClient(base_url=BASE_URL, api_key="")

    def test_api_key_not_stored_as_attribute(self) -> None:
        """API key must not be accessible as a public attribute."""
        client = QovaClient(base_url=BASE_URL, api_key="secret-key-123")
        assert not hasattr(client, "api_key")

    def test_api_key_in_headers(self) -> None:
        """API key must be present in Authorization header."""
        client = QovaClient(base_url=BASE_URL, api_key="test-key")
        assert client._headers["Authorization"] == "Bearer test-key"

    def test_env_var_api_key(self) -> None:
        """Client must accept API key from QOVA_API_KEY env var."""
        with patch.dict(os.environ, {"QOVA_API_KEY": "env-key-456"}):
            client = QovaClient(base_url=BASE_URL)
            assert client._headers["Authorization"] == "Bearer env-key-456"


# ---------------------------------------------------------------------------
#  Error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    @respx.mock
    def test_timeout_raises_QovaTimeoutError(self) -> None:
        """Timeouts must raise QovaTimeoutError."""
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score").mock(
            side_effect=httpx.ReadTimeout("Connection timed out")
        )
        client = QovaClient(base_url=BASE_URL, api_key="test-key", timeout=1.0)
        with pytest.raises(QovaTimeoutError):
            client._request("GET", f"/agents/{AGENT_ADDR}/score")

    @respx.mock
    def test_rate_limit_raises_QovaRateLimitError(self) -> None:
        """429 responses must raise QovaRateLimitError."""
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score").mock(
            return_value=httpx.Response(429, text="Too Many Requests")
        )
        client = QovaClient(base_url=BASE_URL, api_key="test-key")
        with pytest.raises(QovaRateLimitError) as exc_info:
            client._request("GET", f"/agents/{AGENT_ADDR}/score")
        assert exc_info.value.status == 429

    @respx.mock
    def test_server_error_raises_QovaAPIError(self) -> None:
        """5xx responses must raise QovaAPIError with correct status."""
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score").mock(
            return_value=httpx.Response(
                500,
                json={"error": "Internal Server Error"},
                headers={"content-type": "application/json"},
            )
        )
        client = QovaClient(base_url=BASE_URL, api_key="test-key")
        with pytest.raises(QovaAPIError) as exc_info:
            client._request("GET", f"/agents/{AGENT_ADDR}/score")
        assert exc_info.value.status == 500

    @respx.mock
    def test_malformed_json_response(self) -> None:
        """Non-JSON error responses must still raise QovaAPIError."""
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score").mock(
            return_value=httpx.Response(502, text="Bad Gateway")
        )
        client = QovaClient(base_url=BASE_URL, api_key="test-key")
        with pytest.raises(QovaAPIError) as exc_info:
            client._request("GET", f"/agents/{AGENT_ADDR}/score")
        assert exc_info.value.status == 502


# ---------------------------------------------------------------------------
#  Retry logic
# ---------------------------------------------------------------------------


class TestRetryLogic:
    @respx.mock
    def test_retry_on_timeout(self) -> None:
        """Client must retry on timeout with exponential backoff."""
        route = respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score")
        route.side_effect = [
            httpx.ReadTimeout("timeout 1"),
            httpx.Response(
                200,
                json={
                    "agent": AGENT_ADDR,
                    "score": 750,
                    "grade": "AA",
                    "gradeColor": "#22C55E",
                    "scoreFormatted": "750/1000",
                    "scorePercentage": 75.0,
                },
            ),
        ]
        client = QovaClient(base_url=BASE_URL, api_key="test-key", timeout=1.0)
        with patch("qova_langchain.client.time.sleep"):
            result = client._request_with_retry("GET", f"/agents/{AGENT_ADDR}/score")
        assert result["score"] == 750
        assert route.call_count == 2

    @respx.mock
    def test_retry_exhausted_raises(self) -> None:
        """Client must raise after max retries are exhausted."""
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}/score").mock(
            side_effect=httpx.ReadTimeout("timeout")
        )
        client = QovaClient(base_url=BASE_URL, api_key="test-key", timeout=1.0)
        with patch("qova_langchain.client.time.sleep"):
            with pytest.raises(QovaTimeoutError):
                client._request_with_retry(
                    "GET", f"/agents/{AGENT_ADDR}/score", max_retries=1
                )
