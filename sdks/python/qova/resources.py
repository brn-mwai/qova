"""API resource classes — agents, scores, transactions, budgets, webhooks, keys."""

from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional

from .http import HttpTransport


class PaginatedResponse:
    """Wraps a paginated API response with navigation helpers."""

    def __init__(self, data: List[Any], pagination: Dict[str, Any], fetcher: Any) -> None:
        self.data = data
        self.total = pagination.get("total", 0)
        self.limit = pagination.get("limit", 20)
        self.has_more = pagination.get("hasMore", False)
        self.next_cursor = pagination.get("nextCursor")
        self._fetcher = fetcher

    def get_next_page(self) -> Optional["PaginatedResponse"]:
        """Fetch the next page if available."""
        if not self.has_more or not self.next_cursor:
            return None
        return self._fetcher(cursor=self.next_cursor, limit=self.limit)


class Agents:
    """Agent registration, scores, and details."""

    def __init__(self, transport: HttpTransport) -> None:
        self._t = transport

    def list(
        self,
        limit: int = 20,
        cursor: Optional[str] = None,
        sort: str = "desc",
        registered: Optional[bool] = None,
        min_score: Optional[int] = None,
        max_score: Optional[int] = None,
        fields: Optional[List[str]] = None,
    ) -> PaginatedResponse:
        """List agents with cursor-based pagination and filtering."""
        query: Dict[str, str] = {"limit": str(limit), "sort": sort}
        if cursor:
            query["cursor"] = cursor
        if registered is not None:
            query["registered"] = str(registered).lower()
        if min_score is not None:
            query["min_score"] = str(min_score)
        if max_score is not None:
            query["max_score"] = str(max_score)
        if fields:
            query["fields"] = ",".join(fields)

        result = self._t.request("GET", "/api/agents", query=query)
        return PaginatedResponse(
            result.get("data", []),
            result.get("pagination", {}),
            lambda **kw: self.list(**{**{"limit": limit, "sort": sort}, **kw}),
        )

    def list_all(self, limit: int = 100, sort: str = "desc") -> Iterator[Any]:
        """Auto-paginate through all agents."""
        page = self.list(limit=limit, sort=sort)
        yield from page.data
        while page.has_more:
            page = page.get_next_page()
            if page is None:
                break
            yield from page.data

    def get(self, address: str) -> Dict[str, Any]:
        """Get enriched details for a single agent."""
        return self._t.request("GET", f"/api/agents/{address}")

    def score(self, address: str) -> Dict[str, Any]:
        """Get an agent's current score with grade and color."""
        return self._t.request("GET", f"/api/agents/{address}/score")

    def is_registered(self, address: str) -> Dict[str, Any]:
        """Check whether an agent is registered."""
        return self._t.request("GET", f"/api/agents/{address}/registered")

    def register(self, agent: str, *, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Register a new agent on-chain."""
        return self._t.request("POST", "/api/agents/register", body={"agent": agent}, idempotency_key=idempotency_key)

    def update_score(self, address: str, score: int, reason: str = "") -> Dict[str, Any]:
        """Update an agent's reputation score."""
        return self._t.request("POST", f"/api/agents/{address}/score", body={"score": score, "reason": reason})

    def batch_update_scores(self, agents: List[str], scores: List[int], reasons: List[str]) -> Dict[str, Any]:
        """Batch update scores for multiple agents."""
        return self._t.request("POST", "/api/agents/batch-scores", body={"agents": agents, "scores": scores, "reasons": reasons})


class Scores:
    """Score computation, breakdowns, enrichment."""

    def __init__(self, transport: HttpTransport) -> None:
        self._t = transport

    def breakdown(self, address: str) -> Dict[str, Any]:
        return self._t.request("GET", f"/api/scores/{address}/breakdown")

    def compute(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._t.request("POST", "/api/scores/compute", body=data)

    def enrich(self, address: str) -> Dict[str, Any]:
        return self._t.request("POST", "/api/scores/enrich", body={"agent": address})

    def anomaly_check(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._t.request("POST", "/api/scores/anomaly-check", body=data)


class Transactions:
    """Transaction recording and stats."""

    def __init__(self, transport: HttpTransport) -> None:
        self._t = transport

    def stats(self, address: str) -> Dict[str, Any]:
        return self._t.request("GET", f"/api/transactions/{address}")

    def record(self, data: Dict[str, Any], *, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        return self._t.request("POST", "/api/transactions/record", body=data, idempotency_key=idempotency_key)


class Budgets:
    """Budget management and enforcement."""

    def __init__(self, transport: HttpTransport) -> None:
        self._t = transport

    def get(self, address: str) -> Dict[str, Any]:
        return self._t.request("GET", f"/api/budgets/{address}")

    def set(self, address: str, daily_limit: str, monthly_limit: str, per_tx_limit: str) -> Dict[str, Any]:
        return self._t.request("POST", f"/api/budgets/{address}/set", body={
            "dailyLimit": daily_limit,
            "monthlyLimit": monthly_limit,
            "perTxLimit": per_tx_limit,
        })

    def check(self, address: str, amount: str) -> Dict[str, Any]:
        return self._t.request("POST", f"/api/budgets/{address}/check", body={"amount": amount})

    def record_spend(self, address: str, amount: str) -> Dict[str, Any]:
        return self._t.request("POST", f"/api/budgets/{address}/record-spend", body={"amount": amount})


class Keys:
    """API key management."""

    def __init__(self, transport: HttpTransport) -> None:
        self._t = transport

    def create(self, name: str, scopes: List[str], expires_in_days: Optional[int] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {"name": name, "scopes": scopes}
        if expires_in_days:
            body["expiresInDays"] = expires_in_days
        return self._t.request("POST", "/api/keys", body=body)

    def list(self) -> Dict[str, Any]:
        return self._t.request("GET", "/api/keys")

    def revoke(self, key_id: str) -> Dict[str, Any]:
        return self._t.request("DELETE", f"/api/keys/{key_id}")


class Webhooks:
    """Webhook management — CRUD, delivery logs, test ping."""

    def __init__(self, transport: HttpTransport) -> None:
        self._t = transport

    def create(self, url: str, events: List[str], description: Optional[str] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {"url": url, "events": events}
        if description:
            body["description"] = description
        return self._t.request("POST", "/api/webhooks", body=body)

    def list(self) -> Dict[str, Any]:
        return self._t.request("GET", "/api/webhooks")

    def get(self, webhook_id: str) -> Dict[str, Any]:
        return self._t.request("GET", f"/api/webhooks/{webhook_id}")

    def update(self, webhook_id: str, **kwargs: Any) -> Dict[str, Any]:
        return self._t.request("PATCH", f"/api/webhooks/{webhook_id}", body=kwargs)

    def delete(self, webhook_id: str) -> Dict[str, Any]:
        return self._t.request("DELETE", f"/api/webhooks/{webhook_id}")

    def deliveries(self, webhook_id: str, limit: int = 50) -> Dict[str, Any]:
        return self._t.request("GET", f"/api/webhooks/{webhook_id}/deliveries", query={"limit": str(limit)})

    def test(self, webhook_id: str) -> Dict[str, Any]:
        return self._t.request("POST", f"/api/webhooks/{webhook_id}/test")

    def rotate_secret(self, webhook_id: str) -> Dict[str, Any]:
        return self._t.request("POST", f"/api/webhooks/{webhook_id}/rotate-secret")
