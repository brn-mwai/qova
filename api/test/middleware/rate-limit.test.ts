/**
 * Rate limiter security tests.
 * Covers Fix 1.1: IP spoofing prevention via getClientIdentifier.
 * @author Qova Engineering <eng@qova.cc>
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "../../src/middleware/rate-limit.js";

describe("rate limit security", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.TRUST_PROXY;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.TRUST_PROXY;
		} else {
			process.env.TRUST_PROXY = originalEnv;
		}
	});

	it("blocks IP spoofing via x-forwarded-for when TRUST_PROXY is not set", async () => {
		const app = new Hono();
		delete process.env.TRUST_PROXY;
		app.use("*", rateLimit({ windowMs: 60_000, max: 2 }));
		app.get("/test", (c) => c.json({ ok: true }));

		// Two different x-forwarded-for values should NOT create separate buckets
		// when TRUST_PROXY is false -- they should both use the same fallback key
		const res1 = await app.request("/test", {
			headers: { "x-forwarded-for": "1.2.3.4" },
		});
		expect(res1.status).toBe(200);

		const res2 = await app.request("/test", {
			headers: { "x-forwarded-for": "5.6.7.8" },
		});
		expect(res2.status).toBe(200);

		// Third request from "different IP" should be rate limited
		// because they all resolve to the same fallback key
		const res3 = await app.request("/test", {
			headers: { "x-forwarded-for": "9.10.11.12" },
		});
		expect(res3.status).toBe(429);
	});

	it("trusts x-forwarded-for when TRUST_PROXY=true", async () => {
		const app = new Hono();
		process.env.TRUST_PROXY = "true";
		app.use("*", rateLimit({ windowMs: 60_000, max: 1 }));
		app.get("/test", (c) => c.json({ ok: true }));

		// First request from IP A
		const res1 = await app.request("/test", {
			headers: { "x-forwarded-for": "1.2.3.4" },
		});
		expect(res1.status).toBe(200);

		// First request from IP B should also pass (different bucket)
		const res2 = await app.request("/test", {
			headers: { "x-forwarded-for": "5.6.7.8" },
		});
		expect(res2.status).toBe(200);
	});

	it("uses API key for rate limiting when present", async () => {
		const app = new Hono();
		delete process.env.TRUST_PROXY;
		app.use("*", rateLimit({ windowMs: 60_000, max: 2 }));
		app.get("/test", (c) => c.json({ ok: true }));

		// Same API key from "different IPs" should share the same bucket
		const apiKey = "test-api-key-12345678";
		const res1 = await app.request("/test", {
			headers: { "x-api-key": apiKey, "x-forwarded-for": "1.2.3.4" },
		});
		expect(res1.status).toBe(200);

		const res2 = await app.request("/test", {
			headers: { "x-api-key": apiKey, "x-forwarded-for": "5.6.7.8" },
		});
		expect(res2.status).toBe(200);

		// Third request with same API key should be limited
		const res3 = await app.request("/test", {
			headers: { "x-api-key": apiKey, "x-forwarded-for": "9.10.11.12" },
		});
		expect(res3.status).toBe(429);
	});

	it("different API keys get separate rate limit buckets", async () => {
		const app = new Hono();
		delete process.env.TRUST_PROXY;
		app.use("*", rateLimit({ windowMs: 60_000, max: 1 }));
		app.get("/test", (c) => c.json({ ok: true }));

		const res1 = await app.request("/test", {
			headers: { "x-api-key": "key-aaa" },
		});
		expect(res1.status).toBe(200);

		const res2 = await app.request("/test", {
			headers: { "x-api-key": "key-bbb" },
		});
		expect(res2.status).toBe(200);
	});

	it("rate limit rejects after threshold", async () => {
		const app = new Hono();
		delete process.env.TRUST_PROXY;
		app.use("*", rateLimit({ windowMs: 60_000, max: 3 }));
		app.get("/test", (c) => c.json({ ok: true }));

		for (let i = 0; i < 3; i++) {
			const res = await app.request("/test");
			expect(res.status).toBe(200);
		}

		const res = await app.request("/test");
		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
		expect(body.retryAfter).toBeGreaterThan(0);
	});
});
