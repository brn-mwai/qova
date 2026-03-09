/**
 * Sliding-window rate limiter using in-memory store.
 * Tracks request counts per IP with automatic cleanup.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";

/**
 * Determine client identifier for rate limiting.
 * Prefers API key (unforgeable), falls back to IP.
 */
function getClientIdentifier(c: Context): string {
	// Prefer API key if present (unforgeable)
	const apiKey = c.req.header("x-api-key");
	if (apiKey) return `key:${apiKey.substring(0, 16)}`;

	// For IP: only trust x-forwarded-for behind known proxy
	const trustProxy = process.env.TRUST_PROXY === "true";
	if (trustProxy) {
		const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
		if (forwarded) return `ip:${forwarded}`;
	}

	// Fallback: direct connection IP
	return `ip:${c.req.header("x-real-ip") ?? "unknown"}`;
}

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

interface RateLimitOptions {
	/** Time window in milliseconds. */
	windowMs: number;
	/** Max requests per window per IP. */
	max: number;
	/** Custom key extractor (defaults to IP). */
	keyFn?: (c: Context) => string;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

/** Cleanup expired entries every 60s. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [, store] of stores) {
			for (const [key, entry] of store) {
				if (now > entry.resetAt) store.delete(key);
			}
		}
	}, 60_000);
	// Unref so it doesn't prevent process exit
	if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
		cleanupTimer.unref();
	}
}

/**
 * Rate-limiting middleware for Hono.
 *
 * @example
 * ```ts
 * app.use("*", rateLimit({ windowMs: 60_000, max: 100 }));
 * app.use("/api/agents/register", rateLimit({ windowMs: 60_000, max: 10 }));
 * ```
 */
export function rateLimit(
	opts: RateLimitOptions,
): (c: Context, next: Next) => Promise<Response | void> {
	const storeId = `${opts.windowMs}:${opts.max}`;
	if (!stores.has(storeId)) stores.set(storeId, new Map());
	const store = stores.get(storeId)!;
	ensureCleanup();

	return async (c: Context, next: Next) => {
		const key = opts.keyFn ? opts.keyFn(c) : getClientIdentifier(c);

		const now = Date.now();
		const entry = store.get(key);

		if (!entry || now > entry.resetAt) {
			store.set(key, { count: 1, resetAt: now + opts.windowMs });
			c.header("X-RateLimit-Limit", String(opts.max));
			c.header("X-RateLimit-Remaining", String(opts.max - 1));
			c.header(
				"X-RateLimit-Reset",
				String(Math.ceil((now + opts.windowMs) / 1000)),
			);
			await next();
			return;
		}

		entry.count++;

		c.header("X-RateLimit-Limit", String(opts.max));
		c.header(
			"X-RateLimit-Remaining",
			String(Math.max(0, opts.max - entry.count)),
		);
		c.header(
			"X-RateLimit-Reset",
			String(Math.ceil(entry.resetAt / 1000)),
		);

		if (entry.count > opts.max) {
			const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
			c.header("Retry-After", String(retryAfter));
			return c.json(
				{
					error: "Too many requests",
					code: "RATE_LIMIT_EXCEEDED",
					retryAfter,
				},
				429,
			);
		}

		await next();
	};
}
