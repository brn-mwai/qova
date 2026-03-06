/**
 * HTTP transport layer — fetch wrapper with authentication, retries, and error mapping.
 * @author Qova Engineering <eng@qova.cc>
 */

import { QovaApiError, QovaAuthError, QovaNetworkError, QovaRateLimitError } from "./errors.js";

/** SDK version — used in User-Agent header. */
export const SDK_VERSION = "0.2.0";

/** Interceptor called before a request is sent. */
export type RequestInterceptor = (req: { method: string; url: string; headers: Record<string, string>; body?: string }) => void;

/** Interceptor called after a response is received. */
export type ResponseInterceptor = (res: { method: string; url: string; status: number; durationMs: number; headers: Record<string, string> }) => void;

export interface FetchConfig {
	baseUrl: string;
	apiKey: string;
	timeout: number;
	maxRetries: number;
	retryDelay: number;
	headers: Record<string, string>;
	onRequest?: RequestInterceptor;
	onResponse?: ResponseInterceptor;
}

export interface RequestOptions {
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path: string;
	body?: unknown;
	query?: Record<string, string>;
	/** Optional idempotency key for safe retries on mutations. */
	idempotencyKey?: string;
}

/**
 * Pause execution for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add jitter to a delay (±25%) to prevent thundering herd.
 */
function jitter(ms: number): number {
	const factor = 0.75 + Math.random() * 0.5; // 0.75 – 1.25
	return Math.round(ms * factor);
}

/**
 * Build a full URL from base, path, and optional query params.
 */
function buildUrl(base: string, path: string, query?: Record<string, string>): string {
	const url = new URL(path, base);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			url.searchParams.set(key, value);
		}
	}
	return url.toString();
}

/**
 * Determine if an HTTP status code is retryable.
 */
function isRetryable(status: number): boolean {
	return status === 429 || status >= 500;
}

/**
 * Parse the Retry-After header into milliseconds.
 */
function parseRetryAfter(header: string | null): number | null {
	if (!header) return null;
	const seconds = Number.parseInt(header, 10);
	if (!Number.isNaN(seconds)) return seconds * 1000;
	const date = Date.parse(header);
	if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
	return null;
}

/**
 * Parse RFC 7807 Problem Details from an error response body.
 */
interface ProblemDetail {
	type?: string;
	title?: string;
	status?: number;
	detail?: string;
	code?: string;
	errors?: Array<{ field: string; message: string }>;
	retryAfter?: number;
}

function parseProblemDetail(body: unknown): ProblemDetail | null {
	if (!body || typeof body !== "object") return null;
	const obj = body as Record<string, unknown>;
	if (typeof obj.type === "string" && typeof obj.status === "number") {
		return obj as unknown as ProblemDetail;
	}
	return null;
}

/**
 * Safely parse JSON from a response, throwing QovaApiError on parse failure.
 */
function parseJson<T>(text: string, status: number): T {
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new QovaApiError(
			`Invalid JSON in response (status ${status})`,
			status,
			"INVALID_RESPONSE",
			text,
		);
	}
}

/**
 * Execute an HTTP request with retry logic, auth, and error mapping.
 */
export async function request<T>(config: FetchConfig, options: RequestOptions): Promise<T> {
	const url = buildUrl(config.baseUrl, options.path, options.query);
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${config.apiKey}`,
		"User-Agent": `@qova/core/${SDK_VERSION}`,
		...config.headers,
	};

	// Add idempotency key for mutations
	if (options.idempotencyKey) {
		headers["Idempotency-Key"] = options.idempotencyKey;
	}

	const body = options.body ? JSON.stringify(options.body) : undefined;
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		const startTime = Date.now();

		// Fire onRequest interceptor
		if (config.onRequest) {
			try {
				config.onRequest({ method: options.method, url, headers: { ...headers }, body });
			} catch {
				// Interceptor errors should not break the request
			}
		}

		// Create a fresh AbortSignal per attempt so retries get their own timeout window
		const fetchOptions: RequestInit = {
			method: options.method,
			headers,
			body,
			signal: AbortSignal.timeout(config.timeout),
		};

		try {
			const response = await fetch(url, fetchOptions);
			const durationMs = Date.now() - startTime;

			// Fire onResponse interceptor
			if (config.onResponse) {
				const respHeaders: Record<string, string> = {};
				response.headers.forEach((v, k) => { respHeaders[k] = v; });
				try {
					config.onResponse({ method: options.method, url, status: response.status, durationMs, headers: respHeaders });
				} catch {
					// Interceptor errors should not break the request
				}
			}

			// Success — parse JSON safely
			if (response.ok) {
				const text = await response.text();
				if (!text) return {} as T;
				return parseJson<T>(text, response.status);
			}

			// Auth errors — don't retry
			if (response.status === 401 || response.status === 403) {
				const respBody = await response.json().catch(() => ({}));
				const problem = parseProblemDetail(respBody);
				throw new QovaAuthError(
					problem?.detail ?? (respBody as Record<string, string>).error ?? "Authentication failed",
					response.status,
				);
			}

			// Rate limit
			if (response.status === 429) {
				const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
				if (attempt < config.maxRetries) {
					const delay = retryAfter ?? jitter(config.retryDelay * 2 ** attempt);
					await sleep(delay);
					continue;
				}
				throw new QovaRateLimitError(
					retryAfter ?? config.retryDelay,
				);
			}

			// Server errors — retry with jitter
			if (isRetryable(response.status) && attempt < config.maxRetries) {
				await sleep(jitter(config.retryDelay * 2 ** attempt));
				continue;
			}

			// Client error — parse RFC 7807 if available, don't retry
			const respBody = await response.json().catch(() => ({}));
			const problem = parseProblemDetail(respBody);
			throw new QovaApiError(
				problem?.detail ?? (respBody as Record<string, string>).error ?? `Request failed with status ${response.status}`,
				response.status,
				problem?.code ?? (respBody as Record<string, string>).code,
				respBody,
			);
		} catch (error) {
			// Re-throw Qova errors (includes QovaApiError from parseJson)
			if (
				error instanceof QovaApiError ||
				error instanceof QovaAuthError ||
				error instanceof QovaRateLimitError
			) {
				throw error;
			}

			// Network / timeout errors — retry with jitter
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < config.maxRetries) {
				await sleep(jitter(config.retryDelay * 2 ** attempt));
				continue;
			}
		}
	}

	throw new QovaNetworkError(
		lastError?.message ?? "Request failed after retries",
		lastError ?? undefined,
	);
}
