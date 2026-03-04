"""HTTP transport layer — httpx wrapper with auth, retries, and error mapping."""

from __future__ import annotations

import random
import time
from typing import Any, Callable, Dict, Optional
from urllib.parse import urlencode, urljoin

import httpx

from .errors import (
    QovaApiError,
    QovaAuthError,
    QovaNetworkError,
    QovaRateLimitError,
)

SDK_VERSION = "0.2.0"

RequestInterceptor = Callable[[Dict[str, Any]], None]
ResponseInterceptor = Callable[[Dict[str, Any]], None]


class HttpTransport:
    """Sync HTTP client with retry logic, auth, and error mapping."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 30.0,
        max_retries: int = 2,
        retry_delay: float = 1.0,
        headers: Optional[Dict[str, str]] = None,
        on_request: Optional[RequestInterceptor] = None,
        on_response: Optional[ResponseInterceptor] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.extra_headers = headers or {}
        self.on_request = on_request
        self.on_response = on_response
        self._client = httpx.Client(timeout=timeout)

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        query: Optional[Dict[str, str]] = None,
        idempotency_key: Optional[str] = None,
    ) -> Any:
        """Execute an HTTP request with retry logic."""
        url = f"{self.base_url}{path}"
        if query:
            url += "?" + urlencode(query)

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": f"qova-python/{SDK_VERSION}",
            **self.extra_headers,
        }

        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            start = time.monotonic()

            # Fire request interceptor
            if self.on_request:
                try:
                    self.on_request({"method": method, "url": url, "headers": dict(headers)})
                except Exception:
                    pass

            try:
                response = self._client.request(
                    method,
                    url,
                    headers=headers,
                    json=body if body is not None else None,
                )

                duration_ms = (time.monotonic() - start) * 1000

                # Fire response interceptor
                if self.on_response:
                    try:
                        resp_headers = dict(response.headers)
                        self.on_response({
                            "method": method,
                            "url": url,
                            "status": response.status_code,
                            "duration_ms": duration_ms,
                            "headers": resp_headers,
                        })
                    except Exception:
                        pass

                # Success
                if 200 <= response.status_code < 300:
                    if not response.text:
                        return {}
                    return response.json()

                # Auth errors — don't retry
                if response.status_code in (401, 403):
                    body_data = self._safe_json(response)
                    detail = self._extract_detail(body_data)
                    raise QovaAuthError(detail, response.status_code)

                # Rate limit
                if response.status_code == 429:
                    retry_after = self._parse_retry_after(response)
                    if attempt < self.max_retries:
                        delay = retry_after if retry_after else self._jitter(self.retry_delay * (2 ** attempt))
                        time.sleep(delay)
                        continue
                    raise QovaRateLimitError(retry_after or self.retry_delay)

                # Server errors — retry
                if response.status_code >= 500 and attempt < self.max_retries:
                    time.sleep(self._jitter(self.retry_delay * (2 ** attempt)))
                    continue

                # Client error — don't retry
                body_data = self._safe_json(response)
                detail = self._extract_detail(body_data)
                code = self._extract_code(body_data)
                raise QovaApiError(detail, response.status_code, code, body_data)

            except (QovaApiError, QovaAuthError, QovaRateLimitError):
                raise
            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    time.sleep(self._jitter(self.retry_delay * (2 ** attempt)))
                    continue

        raise QovaNetworkError(
            str(last_error) if last_error else "Request failed after retries",
            last_error,
        )

    @staticmethod
    def _jitter(delay: float) -> float:
        """Add ±25% jitter to prevent thundering herd."""
        factor = 0.75 + random.random() * 0.5
        return delay * factor

    @staticmethod
    def _safe_json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except Exception:
            return {}

    @staticmethod
    def _parse_retry_after(response: httpx.Response) -> Optional[float]:
        header = response.headers.get("retry-after")
        if not header:
            return None
        try:
            return float(header)
        except ValueError:
            return None

    @staticmethod
    def _extract_detail(body: Any) -> str:
        """Extract error message, preferring RFC 7807 `detail` field."""
        if isinstance(body, dict):
            return body.get("detail") or body.get("error") or "Request failed"
        return "Request failed"

    @staticmethod
    def _extract_code(body: Any) -> Optional[str]:
        if isinstance(body, dict):
            return body.get("code")
        return None
