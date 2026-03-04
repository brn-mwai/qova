/**
 * Idempotency middleware — caches responses for POST/PUT/DELETE operations
 * keyed by the `Idempotency-Key` header.
 *
 * If a request arrives with the same key and the same method+path,
 * the cached response is returned immediately without re-executing the handler.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { problemResponse } from "./problem.js";

interface CachedResponse {
	status: number;
	body: string;
	headers: Record<string, string>;
	method: string;
	path: string;
	createdAt: number;
}

/** In-memory idempotency cache. */
const cache = new Map<string, CachedResponse>();

/** Default TTL: 24 hours. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Cleanup interval: every 5 minutes. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Periodic cleanup of expired entries. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of cache) {
			if (now - entry.createdAt > DEFAULT_TTL_MS) {
				cache.delete(key);
			}
		}
	}, CLEANUP_INTERVAL_MS);
	// Don't prevent process from exiting
	if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
		cleanupTimer.unref();
	}
}

/**
 * Idempotency middleware.
 *
 * Usage:
 * ```ts
 * app.post("/agents/register", idempotency(), validateBody(schema), async (c) => { ... });
 * ```
 *
 * When `Idempotency-Key` header is present:
 * 1. If key exists in cache AND method+path match → return cached response
 * 2. If key exists but method+path differ → return 422 (misuse)
 * 3. Otherwise → execute handler, cache response, return it
 *
 * When header is absent: request proceeds normally (no caching).
 */
export function idempotency() {
	startCleanup();

	return async (c: Context, next: Next) => {
		const idempotencyKey = c.req.header("Idempotency-Key");

		// No key — proceed without caching
		if (!idempotencyKey) {
			await next();
			return;
		}

		// Validate key format (non-empty, max 256 chars)
		if (idempotencyKey.length > 256) {
			return problemResponse(c, 400, "INVALID_IDEMPOTENCY_KEY", "Invalid Idempotency Key",
				"Idempotency-Key header must be 256 characters or fewer");
		}

		const apiKey = c.get("apiKey") as string | undefined;
		// Namespace by API key to prevent cross-key collisions
		const cacheKey = `${apiKey ?? "anon"}:${idempotencyKey}`;

		const cached = cache.get(cacheKey);

		if (cached) {
			// Verify method+path match — same key on different endpoints is a misuse
			if (cached.method !== c.req.method || cached.path !== c.req.path) {
				return problemResponse(c, 422, "IDEMPOTENCY_KEY_REUSE", "Idempotency Key Already Used",
					"This idempotency key was used on a different endpoint. Use a unique key per request.");
			}

			// Return cached response
			c.header("Idempotency-Replayed", "true");
			for (const [key, value] of Object.entries(cached.headers)) {
				c.header(key, value);
			}
			return c.body(cached.body, cached.status as 200);
		}

		// Execute handler
		await next();

		// Cache the response (only for non-error responses to avoid caching transient failures)
		const status = c.res.status;
		if (status >= 200 && status < 300) {
			const body = await c.res.clone().text();
			const headers: Record<string, string> = {};
			c.res.headers.forEach((value, key) => {
				// Only cache safe headers
				if (key.startsWith("x-") || key === "content-type") {
					headers[key] = value;
				}
			});

			cache.set(cacheKey, {
				status,
				body,
				headers,
				method: c.req.method,
				path: c.req.path,
				createdAt: Date.now(),
			});
		}
	};
}

/** Clear the cache (for testing). */
export function clearIdempotencyCache(): void {
	cache.clear();
}

/** Get cache size (for testing). */
export function getIdempotencyCacheSize(): number {
	return cache.size;
}
