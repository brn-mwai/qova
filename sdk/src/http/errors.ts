/**
 * Error classes for the Qova HTTP SDK.
 * @author Qova Engineering <eng@qova.cc>
 */

/**
 * Base error for all Qova SDK errors.
 */
export class QovaApiError extends Error {
	/** HTTP status code (e.g. 400, 404, 500). */
	readonly status: number;
	/** Machine-readable error code from the API (e.g. "AGENT_NOT_REGISTERED"). */
	readonly code: string | undefined;
	/** Raw response body for debugging. */
	readonly body: unknown;

	constructor(message: string, status: number, code?: string, body?: unknown) {
		super(message);
		this.name = "QovaApiError";
		this.status = status;
		this.code = code;
		this.body = body;
	}
}

/**
 * Thrown when the API key is invalid, expired, or lacks required scopes.
 */
export class QovaAuthError extends QovaApiError {
	constructor(message: string, status: number = 401) {
		super(message, status, "UNAUTHORIZED");
		this.name = "QovaAuthError";
	}
}

/**
 * Thrown when rate limits are exceeded. Includes the recommended retry delay.
 */
export class QovaRateLimitError extends QovaApiError {
	/** Milliseconds to wait before retrying. */
	readonly retryAfterMs: number;

	constructor(retryAfterMs: number) {
		super("Rate limit exceeded", 429, "RATE_LIMITED");
		this.name = "QovaRateLimitError";
		this.retryAfterMs = retryAfterMs;
	}
}

/**
 * Thrown when a network error occurs (timeout, DNS failure, connection refused).
 */
export class QovaNetworkError extends Error {
	readonly cause: Error | undefined;

	constructor(message: string, cause?: Error) {
		super(message);
		this.name = "QovaNetworkError";
		this.cause = cause;
	}
}

/**
 * Thrown when required configuration is missing or invalid.
 */
export class QovaConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "QovaConfigError";
	}
}
