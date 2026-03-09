"""
Unit tests for CrewAI QovaClient security, error handling, and retry logic.

Tests client initialization, API key handling, and error classification
without importing the tools module (which depends on crewai_tools).

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
import respx

# Load client and types modules directly to avoid __init__.py importing tools.py
# (tools.py depends on crewai_tools.BaseTool which may not be installed)
_src = Path(__file__).resolve().parent.parent / "src" / "qova_crewai"

def _load_module(name: str, filepath: Path):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    sys.modules[name] = mod
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod

_types_mod = _load_module("qova_crewai.types", _src / "types.py")
_client_mod = _load_module("qova_crewai.client", _src / "client.py")

QovaClient = _client_mod.QovaClient
QovaApiError = _types_mod.QovaApiError
QovaTimeoutError = _types_mod.QovaTimeoutError
QovaRateLimitError = _types_mod.QovaRateLimitError

BASE_URL = "https://test.qova.cc"
AGENT_ADDR = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"


# ---------------------------------------------------------------------------
#  API Key validation
# ---------------------------------------------------------------------------


class TestApiKeyHandling:
    def test_missing_api_key_raises(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("QOVA_API_KEY", None)
            with pytest.raises(ValueError, match="QOVA_API_KEY required"):
                QovaClient(base_url=BASE_URL)

    def test_empty_api_key_raises(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("QOVA_API_KEY", None)
            with pytest.raises(ValueError, match="QOVA_API_KEY required"):
                QovaClient(base_url=BASE_URL, api_key="")

    def test_api_key_not_stored_as_attribute(self) -> None:
        client = QovaClient(base_url=BASE_URL, api_key="secret-key")
        assert not hasattr(client, "api_key")

    def test_auth_header_set_in_client(self) -> None:
        client = QovaClient(base_url=BASE_URL, api_key="test-key")
        assert client._auth_header == "Bearer test-key"

    def test_env_var_api_key(self) -> None:
        with patch.dict(os.environ, {"QOVA_API_KEY": "env-key-456"}):
            client = QovaClient(base_url=BASE_URL)
            assert client._auth_header == "Bearer env-key-456"


# ---------------------------------------------------------------------------
#  Error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    @respx.mock
    def test_timeout_raises_QovaTimeoutError(self) -> None:
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}").mock(
            side_effect=httpx.ReadTimeout("timed out")
        )
        with QovaClient(base_url=BASE_URL, api_key="test-key") as client:
            with pytest.raises(QovaTimeoutError):
                client._request("GET", f"/agents/{AGENT_ADDR}")

    @respx.mock
    def test_rate_limit_raises_QovaRateLimitError(self) -> None:
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}").mock(
            return_value=httpx.Response(429, text="Too Many Requests")
        )
        with QovaClient(base_url=BASE_URL, api_key="test-key") as client:
            with pytest.raises(QovaRateLimitError):
                client._request("GET", f"/agents/{AGENT_ADDR}")

    @respx.mock
    def test_server_error_raises_QovaApiError(self) -> None:
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}").mock(
            return_value=httpx.Response(500, json={"error": "Internal Server Error"})
        )
        with QovaClient(base_url=BASE_URL, api_key="test-key") as client:
            with pytest.raises(QovaApiError) as exc_info:
                client._request("GET", f"/agents/{AGENT_ADDR}")
            assert exc_info.value.status_code == 500


# ---------------------------------------------------------------------------
#  Retry logic
# ---------------------------------------------------------------------------


class TestRetryLogic:
    @respx.mock
    def test_retry_on_timeout(self) -> None:
        route = respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}")
        route.side_effect = [
            httpx.ReadTimeout("timeout"),
            httpx.Response(200, json={"agent": AGENT_ADDR, "score": 750}),
        ]
        with QovaClient(base_url=BASE_URL, api_key="test-key", timeout=1.0) as client:
            with patch.object(_client_mod.time, "sleep"):
                result = client._request_with_retry("GET", f"/agents/{AGENT_ADDR}")
        assert result["score"] == 750
        assert route.call_count == 2

    @respx.mock
    def test_retry_exhausted_raises(self) -> None:
        respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}").mock(
            side_effect=httpx.ReadTimeout("timeout")
        )
        with QovaClient(base_url=BASE_URL, api_key="test-key", timeout=1.0) as client:
            with patch.object(_client_mod.time, "sleep"):
                with pytest.raises(QovaTimeoutError):
                    client._request_with_retry(
                        "GET", f"/agents/{AGENT_ADDR}", max_retries=1
                    )

    @respx.mock
    def test_retry_on_rate_limit(self) -> None:
        route = respx.get(f"{BASE_URL}/api/agents/{AGENT_ADDR}")
        route.side_effect = [
            httpx.Response(429, text="Rate limited"),
            httpx.Response(200, json={"agent": AGENT_ADDR, "score": 800}),
        ]
        with QovaClient(base_url=BASE_URL, api_key="test-key") as client:
            with patch.object(_client_mod.time, "sleep"):
                result = client._request_with_retry("GET", f"/agents/{AGENT_ADDR}")
        assert result["score"] == 800
