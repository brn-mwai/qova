"""
Qova REST API client.

Lightweight HTTP client for the Qova API (api.qova.cc) using httpx.
All tools delegate to this client for actual API communication.

Author: Qova Engineering <eng@qova.cc>
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

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
    QovaRateLimitError,
    QovaTimeoutError,
    ScoreBreakdown,
    ScoreFactor,
    TransactionStats,
    WriteResult,
)

_DEFAULT_BASE_URL = "https://api.qova.cc"
_DEFAULT_TIMEOUT = 30.0


class QovaClient:
    """HTTP client for the Qova REST API.

    Configuration is loaded from environment variables:
    - ``QOVA_API_URL``: Base URL (default: https://api.qova.cc)
    - ``QOVA_API_KEY``: API key for authenticated endpoints

    Args:
        base_url: Override the base URL. Falls back to ``QOVA_API_URL`` env var.
        api_key: Override the API key. Falls back to ``QOVA_API_KEY`` env var.
        timeout: Request timeout in seconds. Default: 30.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = (base_url or os.environ.get("QOVA_API_URL", _DEFAULT_BASE_URL)).rstrip("/")
        self.timeout = timeout
        self._client: httpx.Client | None = None

        # Resolve API key but only store in header, not as attribute
        key = api_key or os.environ.get("QOVA_API_KEY")
        if not key:
            raise ValueError("QOVA_API_KEY required: pass api_key or set env var")
        self._auth_header = f"Bearer {key}"

    @property
    def client(self) -> httpx.Client:
        """Lazy-initialized httpx client with default headers."""
        if self._client is None or self._client.is_closed:
            headers: dict[str, str] = {
                "Accept": "application/json",
                "User-Agent": "qova-crewai/0.1.0",
                "Authorization": self._auth_header,
            }
            self._client = httpx.Client(
                base_url=self.base_url,
                headers=headers,
                timeout=self.timeout,
            )
        return self._client

    def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client is not None and not self._client.is_closed:
            self._client.close()

    def __enter__(self) -> QovaClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    # -- internal helpers ---------------------------------------------------

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """Make an HTTP request and return the parsed JSON response.

        Raises ``QovaTimeoutError`` on timeout, ``QovaRateLimitError`` on 429,
        and ``QovaApiError`` on other non-2xx responses.
        """
        url = f"/api{path}"
        try:
            response = self.client.request(method, url, **kwargs)
        except httpx.TimeoutException as exc:
            raise QovaTimeoutError(
                status_code=408,
                message=f"Request timed out after {self.timeout}s",
                url=f"{self.base_url}{url}",
            ) from exc
        except httpx.HTTPError as exc:
            raise QovaApiError(
                status_code=0,
                message=f"HTTP error: {exc}",
                url=f"{self.base_url}{url}",
            ) from exc

        if response.status_code == 429:
            raise QovaRateLimitError(
                status_code=429,
                message="Rate limited",
                url=f"{self.base_url}{url}",
            )

        if response.status_code >= 400:
            try:
                body = response.json()
                message = body.get("error", body.get("message", response.text))
            except Exception:
                message = response.text
            raise QovaApiError(
                status_code=response.status_code,
                message=str(message),
                url=f"{self.base_url}{url}",
            )

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
        raise QovaApiError(0, "Max retries exceeded", f"{self.base_url}/api{path}")

    def _get(self, path: str) -> dict[str, Any]:
        return self._request("GET", path)

    def _post(self, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("POST", path, json=json)

    # -- Agent endpoints ----------------------------------------------------

    def get_agent_details(self, address: str) -> AgentDetails:
        """Fetch enriched agent details including score, grade, and metadata.

        ``GET /api/agents/:address``
        """
        data = self._get(f"/agents/{address}")
        return AgentDetails(
            agent=data["agent"],
            score=data["score"],
            grade=data["grade"],
            grade_color=data["gradeColor"],
            score_formatted=data["scoreFormatted"],
            score_percentage=data["scorePercentage"],
            last_updated=data["lastUpdated"],
            update_count=data["updateCount"],
            is_registered=data["isRegistered"],
            address_short=data["addressShort"],
            explorer_url=data["explorerUrl"],
        )

    def get_agent_score(self, address: str) -> AgentScore:
        """Fetch an agent's current score and grade.

        ``GET /api/agents/:address/score``
        """
        data = self._get(f"/agents/{address}/score")
        return AgentScore(
            agent=data["agent"],
            score=data["score"],
            grade=data["grade"],
            grade_color=data["gradeColor"],
            score_formatted=data["scoreFormatted"],
            score_percentage=data["scorePercentage"],
        )

    def is_agent_registered(self, address: str) -> bool:
        """Check if an agent is registered on-chain.

        ``GET /api/agents/:address/registered``
        """
        data = self._get(f"/agents/{address}/registered")
        return bool(data["isRegistered"])

    def register_agent(self, address: str) -> WriteResult:
        """Register a new agent on-chain.

        ``POST /api/agents/register``
        """
        data = self._post("/agents/register", json={"agent": address})
        return WriteResult(tx_hash=data["txHash"], agent=data["agent"])

    # -- Score endpoints ----------------------------------------------------

    def get_score_breakdown(self, address: str) -> ScoreBreakdown:
        """Fetch the full score breakdown with factor contributions.

        ``GET /api/scores/:address``
        """
        data = self._get(f"/scores/{address}")
        factors: dict[str, ScoreFactor] = {}
        for key, val in data.get("factors", {}).items():
            factors[key] = ScoreFactor(
                raw=val["raw"],
                normalized=val["normalized"],
                weight=val["weight"],
                contribution=val["contribution"],
            )
        return ScoreBreakdown(
            agent=data["agent"],
            score=data["score"],
            grade=data["grade"],
            grade_color=data["gradeColor"],
            factors=factors,
            timestamp=data["timestamp"],
        )

    def compute_score(
        self,
        total_volume: str,
        transaction_count: int,
        success_rate: int,
        daily_spent: str,
        daily_limit: str,
        account_age_seconds: int,
        sanctions_clean: bool = True,
        api_reputation_score: int | None = None,
    ) -> ComputedScore:
        """Compute a reputation score from raw metrics (stateless, no on-chain read).

        ``POST /api/scores/compute``

        Args:
            total_volume: Total transaction volume in wei (string).
            transaction_count: Number of transactions.
            success_rate: Success rate in basis points (0-10000).
            daily_spent: Daily amount spent in wei (string).
            daily_limit: Daily budget limit in wei (string).
            account_age_seconds: Age of the agent account in seconds.
            sanctions_clean: Whether the agent is sanctions-clean.
            api_reputation_score: Optional external reputation score (0-100).
        """
        payload: dict[str, Any] = {
            "totalVolume": total_volume,
            "transactionCount": transaction_count,
            "successRate": success_rate,
            "dailySpent": daily_spent,
            "dailyLimit": daily_limit,
            "accountAgeSeconds": account_age_seconds,
            "sanctionsClean": sanctions_clean,
        }
        if api_reputation_score is not None:
            payload["apiReputationScore"] = api_reputation_score
        data = self._post("/scores/compute", json=payload)
        return ComputedScore(
            score=data["score"],
            grade=data["grade"],
            grade_color=data["gradeColor"],
        )

    # -- Transaction endpoints ----------------------------------------------

    def get_transaction_stats(self, address: str) -> TransactionStats:
        """Fetch transaction statistics for an agent.

        ``GET /api/transactions/:address/stats``
        """
        data = self._get(f"/transactions/{address}/stats")
        return TransactionStats(
            agent=data["agent"],
            total_count=data["totalCount"],
            total_volume=data["totalVolume"],
            total_volume_wei=data["totalVolumeWei"],
            success_rate=data["successRate"],
            success_rate_bps=data["successRateBps"],
            last_activity=data["lastActivity"],
            address_short=data["addressShort"],
        )

    def record_transaction(
        self,
        agent: str,
        tx_hash: str,
        amount: str,
        tx_type: int,
    ) -> WriteResult:
        """Record a transaction for an agent.

        ``POST /api/transactions/record``

        Args:
            agent: Agent's Ethereum address.
            tx_hash: Transaction hash (hex string).
            amount: Transaction amount in wei (string).
            tx_type: Transaction type (0=PAYMENT, 1=SWAP, 2=TRANSFER,
                     3=CONTRACT_CALL, 4=BRIDGE).
        """
        data = self._post(
            "/transactions/record",
            json={
                "agent": agent,
                "txHash": tx_hash,
                "amount": amount,
                "txType": tx_type,
            },
        )
        return WriteResult(tx_hash=data["txHash"], agent=data["agent"])

    # -- Budget endpoints ---------------------------------------------------

    def get_budget_status(self, address: str) -> BudgetStatus:
        """Fetch the current budget status for an agent.

        ``GET /api/budgets/:address``
        """
        data = self._get(f"/budgets/{address}")
        return BudgetStatus(
            agent=data["agent"],
            config=BudgetConfig(
                daily_limit=data["config"]["dailyLimit"],
                monthly_limit=data["config"]["monthlyLimit"],
                per_tx_limit=data["config"]["perTxLimit"],
            ),
            usage=BudgetUsage(
                daily_spent=data["usage"]["dailySpent"],
                monthly_spent=data["usage"]["monthlySpent"],
                daily_remaining=data["usage"]["dailyRemaining"],
                monthly_remaining=data["usage"]["monthlyRemaining"],
            ),
            utilization=BudgetUtilization(
                daily=data["utilization"]["daily"],
                monthly=data["utilization"]["monthly"],
            ),
            raw=data.get("raw", {}),
        )

    def check_budget(self, address: str, amount: str) -> BudgetCheckResult:
        """Check if a spend amount is within an agent's budget.

        ``POST /api/budgets/:address/check``

        Args:
            address: Agent's Ethereum address.
            amount: Amount to check in wei (string).
        """
        data = self._post(f"/budgets/{address}/check", json={"amount": amount})
        return BudgetCheckResult(
            agent=data["agent"],
            within_budget=data["withinBudget"],
            amount=data["amount"],
        )
