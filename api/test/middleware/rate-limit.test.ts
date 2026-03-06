/**
 * Tests for rate limiting middleware.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { rateLimiter, clearRateLimitStore } from "../../src/middleware/rate-limit.js";

function createTestApp(max: number = 3): Hono {
	const app = new Hono();
	app.use("/*", rateLimiter({ windowMs: 60_000, max }));
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("rateLimiter middleware", () => {
	beforeEach(() => {
		clearRateLimitStore();
	});

	it("allows requests under the limit", async () => {
		const app = createTestApp(5);
		const res = await app.request("/test");
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
	});

	it("returns rate limit headers", async () => {
		const app = createTestApp(10);
		const res = await app.request("/test");
		expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
		expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
		expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
	});

	it("decrements remaining count", async () => {
		const app = createTestApp(5);

		const res1 = await app.request("/test");
		expect(res1.headers.get("X-RateLimit-Remaining")).toBe("4");

		const res2 = await app.request("/test");
		expect(res2.headers.get("X-RateLimit-Remaining")).toBe("3");

		const res3 = await app.request("/test");
		expect(res3.headers.get("X-RateLimit-Remaining")).toBe("2");
	});

	it("returns 429 when limit is exceeded", async () => {
		const app = createTestApp(2);

		await app.request("/test"); // 1
		await app.request("/test"); // 2
		const res = await app.request("/test"); // 3 → over limit

		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body.code).toBe("RATE_LIMITED");
		expect(body.retryAfter).toBeGreaterThan(0);
		expect(res.headers.get("Retry-After")).toBeTruthy();
	});

	it("remaining shows 0 at limit, not negative", async () => {
		const app = createTestApp(2);

		await app.request("/test");
		const res = await app.request("/test");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
	});

	it("clearRateLimitStore resets counts", async () => {
		const app = createTestApp(2);

		await app.request("/test");
		await app.request("/test");

		clearRateLimitStore();

		const res = await app.request("/test");
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("1");
	});
});
