"""Qova SDK client — primary interface for developers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

from .errors import QovaConfigError
from .http import HttpTransport, RequestInterceptor, ResponseInterceptor
from .resources import Agents, Budgets, Keys, Scores, Transactions, Webhooks


@dataclass
class QovaOptions:
    """Configuration options for the Qova client."""

    base_url: str = "https://api.qova.cc"
    timeout: float = 30.0
    max_retries: int = 2
    retry_delay: float = 1.0
    headers: Dict[str, str] = field(default_factory=dict)
    on_request: Optional[RequestInterceptor] = None
    on_response: Optional[ResponseInterceptor] = None


class Qova:
    """
    Qova Protocol SDK — financial trust infrastructure for AI agents.

    Usage::

        from qova import Qova

        client = Qova("qova_your_api_key")

        # Get an agent's trust score
        result = client.agents.score("0x...")
        print(f"Score: {result['score']}, Grade: {result['grade']}")

        # Auto-paginate through all agents
        for agent in client.agents.list_all():
            print(agent)

        # With interceptors for logging
        client = Qova("qova_your_api_key", QovaOptions(
            on_request=lambda req: print(f"→ {req['method']} {req['url']}"),
            on_response=lambda res: print(f"← {res['status']} ({res['duration_ms']:.0f}ms)"),
        ))
    """

    def __init__(self, api_key: str, options: Optional[QovaOptions] = None) -> None:
        if not api_key or not isinstance(api_key, str):
            raise QovaConfigError(
                "API key is required. Get one at https://qova.cc/dashboard/settings/api-keys"
            )

        if not api_key.startswith("qova_"):
            raise QovaConfigError("Invalid API key format. Keys start with qova_")

        opts = options or QovaOptions()

        self._transport = HttpTransport(
            base_url=opts.base_url,
            api_key=api_key,
            timeout=opts.timeout,
            max_retries=opts.max_retries,
            retry_delay=opts.retry_delay,
            headers=opts.headers,
            on_request=opts.on_request,
            on_response=opts.on_response,
        )

        self.agents = Agents(self._transport)
        self.scores = Scores(self._transport)
        self.transactions = Transactions(self._transport)
        self.budgets = Budgets(self._transport)
        self.keys = Keys(self._transport)
        self.webhooks = Webhooks(self._transport)

    def verify(self, agent: str) -> Dict[str, Any]:
        """Quick trust verification before a transaction."""
        return self._transport.request("POST", "/api/verify/agent", body={"agent": agent})

    def sanctions_check(self, agent: str) -> Dict[str, Any]:
        """Sanctions screening on an agent address."""
        return self._transport.request("POST", "/api/verify/sanctions", body={"agent": agent})

    def health(self) -> Dict[str, Any]:
        """API health check."""
        return self._transport.request("GET", "/api/health")

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._transport.close()

    def __enter__(self) -> "Qova":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
