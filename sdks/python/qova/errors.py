"""Typed error classes for the Qova SDK."""

from __future__ import annotations

from typing import Any, Optional


class QovaError(Exception):
    """Base class for all Qova SDK errors."""

    def __init__(self, message: str, code: Optional[str] = None) -> None:
        super().__init__(message)
        self.code = code


class QovaApiError(QovaError):
    """HTTP error from the Qova API (4xx or 5xx)."""

    def __init__(
        self,
        message: str,
        status: int,
        code: Optional[str] = None,
        body: Optional[Any] = None,
    ) -> None:
        super().__init__(message, code)
        self.status = status
        self.body = body


class QovaAuthError(QovaApiError):
    """Authentication or authorization failure (401/403)."""

    def __init__(self, message: str = "Authentication failed", status: int = 401) -> None:
        super().__init__(message, status, "UNAUTHORIZED")


class QovaRateLimitError(QovaApiError):
    """Rate limit exceeded (429)."""

    def __init__(self, retry_after: float = 1.0) -> None:
        super().__init__(
            f"Rate limit exceeded. Retry after {retry_after}s",
            429,
            "RATE_LIMITED",
        )
        self.retry_after = retry_after


class QovaNetworkError(QovaError):
    """Network or timeout error."""

    def __init__(self, message: str = "Network request failed", cause: Optional[Exception] = None) -> None:
        super().__init__(message, "NETWORK_ERROR")
        self.__cause__ = cause


class QovaConfigError(QovaError):
    """Invalid SDK configuration."""

    def __init__(self, message: str) -> None:
        super().__init__(message, "CONFIG_ERROR")
