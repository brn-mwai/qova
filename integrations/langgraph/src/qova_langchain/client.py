"""
HTTP client wrapper for the Qova REST API.

Provides both sync and async methods for all Qova endpoints.
Uses httpx for HTTP transport with automatic retries and timeouts.
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

import httpx

from qova_langchain.types import (
    AgentScoreResponse,
    BudgetCheckResponse,
    BudgetSetResponse,
    BudgetStatusResponse,
    ComputeScoreResponse,
    QovaAPIError,
    QovaError,
    QovaRateLimitError,
    QovaTimeoutError,
    RecordTransactionResponse,
    RegisterAgentResponse,
    ScoreBreakdownResponse,
)

_DEFAULT_BASE_URL = "https://api.qova.cc"
_DEFAULT_TIMEOUT = 30.0


class QovaClient:
    """HTTP client for the Qova REST API.

    Configuration is read from environment variables:
        - ``QOVA_API_URL``: Base URL (default: https://api.qova.cc)
        - ``QOVA_API_KEY``: API key for authentication

    Args:
        base_url: Override the base URL (takes precedence over env var).
        api_key: Override the API key (takes precedence over env var).
        timeout: Request timeout in seconds (default: 30).
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("QOVA_API_URL", _DEFAULT_BASE_URL)
        ).rstrip("/")
        self.timeout = timeout

        # Resolve API key but only store in header, not as attribute
        key = api_key or os.environ.get("QOVA_API_KEY")
        if not key:
            raise ValueError("QOVA_API_KEY required: pass api_key or set env var")

        self._headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "qova-langchain/0.1.0",
            "Authorization": f"Bearer {key}",
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _url(self, path: str) -> str:
        return f"{self.base_url}/api{path}"

    def _handle_error(self, response: httpx.Response) -> QovaError:
        """Parse an error response into a structured QovaError."""
        try:
            body = response.json()
            message = body.get("error", body.get("message", response.reason_phrase or "Unknown"))
            detail = body.get("detail")
        except Exception:
            message = response.reason_phrase or "Unknown error"
            detail = response.text[:500] if response.text else None

        return QovaError(
            status_code=response.status_code,
            message=str(message),
            detail=str(detail) if detail else None,
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """Make an HTTP request, raising typed exceptions on failure."""
        url = self._url(path)
        try:
            with self._sync_client() as client:
                response = client.request(method, url, **kwargs)
        except httpx.TimeoutException as e:
            raise QovaTimeoutError(0, "Request timed out", str(e)) from e

        if response.status_code == 429:
            raise QovaRateLimitError(429, "Rate limited", response.text[:200])
        if response.status_code >= 400:
            try:
                body = response.json()
                msg = body.get("error", body.get("message", "Unknown"))
                detail = body.get("detail")
            except Exception:
                msg = response.text[:200] if response.text else "Unknown error"
                detail = None
            raise QovaAPIError(response.status_code, str(msg), str(detail) if detail else None)

        return response.json()  # type: ignore[no-any-return]

    def _request_with_retry(
        self, method: str, path: str, max_retries: int = 2, **kwargs: Any
    ) -> dict[str, Any]:
        """Make a request with exponential backoff on timeout/rate-limit."""
        for attempt in range(max_retries + 1):
            try:
                return self._request(method, path, **kwargs)
            except QovaTimeoutError:
                if attempt == max_retries:
                    raise
                time.sleep(2 ** attempt)
            except QovaRateLimitError:
                if attempt == max_retries:
                    raise
                time.sleep(5)
        raise QovaAPIError(0, "Max retries exceeded")  # unreachable but satisfies type checker

    # ------------------------------------------------------------------
    # Sync methods
    # ------------------------------------------------------------------

    def _sync_client(self) -> httpx.Client:
        return httpx.Client(
            headers=self._headers,
            timeout=self.timeout,
            follow_redirects=True,
        )

    def get_score(self, address: str) -> AgentScoreResponse | QovaError:
        """GET /api/agents/:address/score - Current score with grade and color."""
        with self._sync_client() as client:
            resp = client.get(self._url(f"/agents/{address}/score"))
            if resp.is_success:
                return AgentScoreResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def get_score_breakdown(self, address: str) -> ScoreBreakdownResponse | QovaError:
        """GET /api/scores/:address - Full score breakdown with factor analysis."""
        with self._sync_client() as client:
            resp = client.get(self._url(f"/scores/{address}"))
            if resp.is_success:
                return ScoreBreakdownResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def register_agent(self, address: str) -> RegisterAgentResponse | QovaError:
        """POST /api/agents/register - Register a new AI agent on-chain."""
        with self._sync_client() as client:
            resp = client.post(
                self._url("/agents/register"),
                json={"agent": address},
            )
            if resp.is_success:
                return RegisterAgentResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def record_transaction(
        self,
        agent: str,
        tx_hash: str,
        amount: str,
        tx_type: int,
    ) -> RecordTransactionResponse | QovaError:
        """POST /api/transactions/record - Record a financial transaction."""
        with self._sync_client() as client:
            resp = client.post(
                self._url("/transactions/record"),
                json={
                    "agent": agent,
                    "txHash": tx_hash,
                    "amount": amount,
                    "txType": tx_type,
                },
            )
            if resp.is_success:
                return RecordTransactionResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def check_budget(self, agent: str, amount: str) -> BudgetCheckResponse | QovaError:
        """POST /api/budgets/:address/check - Check budget compliance."""
        with self._sync_client() as client:
            resp = client.post(
                self._url(f"/budgets/{agent}/check"),
                json={"amount": amount},
            )
            if resp.is_success:
                return BudgetCheckResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def set_budget(
        self,
        agent: str,
        daily_limit: str,
        monthly_limit: str,
        per_tx_limit: str,
    ) -> BudgetSetResponse | QovaError:
        """POST /api/budgets/:address/set - Set budget limits."""
        with self._sync_client() as client:
            resp = client.post(
                self._url(f"/budgets/{agent}/set"),
                json={
                    "dailyLimit": daily_limit,
                    "monthlyLimit": monthly_limit,
                    "perTxLimit": per_tx_limit,
                },
            )
            if resp.is_success:
                return BudgetSetResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def get_budget_status(self, agent: str) -> BudgetStatusResponse | QovaError:
        """GET /api/budgets/:address - Get current budget status."""
        with self._sync_client() as client:
            resp = client.get(self._url(f"/budgets/{agent}"))
            if resp.is_success:
                return BudgetStatusResponse.model_validate(resp.json())
            return self._handle_error(resp)

    def compute_score(self, metrics: dict[str, Any]) -> ComputeScoreResponse | QovaError:
        """POST /api/scores/compute - Compute score from raw metrics (stateless)."""
        with self._sync_client() as client:
            resp = client.post(self._url("/scores/compute"), json=metrics)
            if resp.is_success:
                return ComputeScoreResponse.model_validate(resp.json())
            return self._handle_error(resp)

    # ------------------------------------------------------------------
    # Async methods
    # ------------------------------------------------------------------

    def _async_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            headers=self._headers,
            timeout=self.timeout,
            follow_redirects=True,
        )

    async def aget_score(self, address: str) -> AgentScoreResponse | QovaError:
        """Async GET /api/agents/:address/score."""
        async with self._async_client() as client:
            resp = await client.get(self._url(f"/agents/{address}/score"))
            if resp.is_success:
                return AgentScoreResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def aget_score_breakdown(self, address: str) -> ScoreBreakdownResponse | QovaError:
        """Async GET /api/scores/:address."""
        async with self._async_client() as client:
            resp = await client.get(self._url(f"/scores/{address}"))
            if resp.is_success:
                return ScoreBreakdownResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def aregister_agent(self, address: str) -> RegisterAgentResponse | QovaError:
        """Async POST /api/agents/register."""
        async with self._async_client() as client:
            resp = await client.post(
                self._url("/agents/register"),
                json={"agent": address},
            )
            if resp.is_success:
                return RegisterAgentResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def arecord_transaction(
        self,
        agent: str,
        tx_hash: str,
        amount: str,
        tx_type: int,
    ) -> RecordTransactionResponse | QovaError:
        """Async POST /api/transactions/record."""
        async with self._async_client() as client:
            resp = await client.post(
                self._url("/transactions/record"),
                json={
                    "agent": agent,
                    "txHash": tx_hash,
                    "amount": amount,
                    "txType": tx_type,
                },
            )
            if resp.is_success:
                return RecordTransactionResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def acheck_budget(self, agent: str, amount: str) -> BudgetCheckResponse | QovaError:
        """Async POST /api/budgets/:address/check."""
        async with self._async_client() as client:
            resp = await client.post(
                self._url(f"/budgets/{agent}/check"),
                json={"amount": amount},
            )
            if resp.is_success:
                return BudgetCheckResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def aset_budget(
        self,
        agent: str,
        daily_limit: str,
        monthly_limit: str,
        per_tx_limit: str,
    ) -> BudgetSetResponse | QovaError:
        """Async POST /api/budgets/:address/set."""
        async with self._async_client() as client:
            resp = await client.post(
                self._url(f"/budgets/{agent}/set"),
                json={
                    "dailyLimit": daily_limit,
                    "monthlyLimit": monthly_limit,
                    "perTxLimit": per_tx_limit,
                },
            )
            if resp.is_success:
                return BudgetSetResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def aget_budget_status(self, agent: str) -> BudgetStatusResponse | QovaError:
        """Async GET /api/budgets/:address."""
        async with self._async_client() as client:
            resp = await client.get(self._url(f"/budgets/{agent}"))
            if resp.is_success:
                return BudgetStatusResponse.model_validate(resp.json())
            return self._handle_error(resp)

    async def acompute_score(self, metrics: dict[str, Any]) -> ComputeScoreResponse | QovaError:
        """Async POST /api/scores/compute."""
        async with self._async_client() as client:
            resp = await client.post(self._url("/scores/compute"), json=metrics)
            if resp.is_success:
                return ComputeScoreResponse.model_validate(resp.json())
            return self._handle_error(resp)
