/**
 * Rate limiting middleware.
 *
 * Sliding window counter keyed by API key prefix (or IP for unauthenticated).
 * Returns standard rate limit headers so SDK consumers can implement backoff.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { problemResponse } from "./problem.js";

interface RateLimitOptions {
	/** Time window in milliseconds. Default: 60000 (1 minute). */
	windowMs: number;
	/** Max requests per window. Default: 120. */
	max: number;
}

interface WindowEntry {
	count: number;
	resetAt: number;
}

/** In-memory store — keyed by identifier + route prefix. */
const store = new Map<string, WindowEntry>();

/** Cleanup expired entries every 30 seconds. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (now > entry.resetAt) {
				store.delete(key);
			}
		}
	}, 30_000);
	// Don't prevent process exit
	if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
		cleanupTimer.unref();
	}
}

/**
 * Extract a rate-limit key from the request.
 * Prefers API key prefix (so each key gets its own quota),
 * falls back to IP for unauthenticated requests.
 */
function getKey(c: Context): string {
	const apiKey = c.get("apiKey") as { keyPrefix: string } | undefined;
	if (apiKey?.keyPrefix) return apiKey.keyPrefix;

	// Fall back to IP
	const forwarded = c.req.header("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]!.trim();

	const realIp = c.req.header("x-real-ip");
	if (realIp) return realIp;

	return "unknown";
}

/**
 * Rate limiting middleware for Hono.
 *
 * @example
 * app.use("/api/agents/*", rateLimiter({ windowMs: 60000, max: 120 }));
 */
export function rateLimiter(
	options: RateLimitOptions = { windowMs: 60_000, max: 120 },
): (c: Context, next: Next) => Promise<Response | void> {
	ensureCleanup();

	return async (c: Context, next: Next) => {
		const identifier = getKey(c);
		const now = Date.now();

		// Build a key that includes the route group
		const pathPrefix = c.req.path.split("/").slice(0, 3).join("/");
		const storeKey = `${identifier}:${pathPrefix}`;

		let entry = store.get(storeKey);

		if (!entry || now > entry.resetAt) {
			entry = { count: 0, resetAt: now + options.windowMs };
			store.set(storeKey, entry);
		}

		entry.count++;

		// Set rate limit headers on every response
		const remaining = Math.max(0, options.max - entry.count);
		const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

		c.header("X-RateLimit-Limit", String(options.max));
		c.header("X-RateLimit-Remaining", String(remaining));
		c.header("X-RateLimit-Reset", String(resetSeconds));

		if (entry.count > options.max) {
			c.header("Retry-After", String(resetSeconds));
			return problemResponse(c, 429, "RATE_LIMITED", "Rate Limit Exceeded",
				`You have exceeded the rate limit of ${options.max} requests per ${options.windowMs / 1000}s`,
				{ retryAfter: resetSeconds });
		}

		await next();
	};
}

/** Clear the rate limit store. Useful for testing. */
export function clearRateLimitStore(): void {
	store.clear();
}
