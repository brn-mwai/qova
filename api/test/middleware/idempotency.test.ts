import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { idempotency, clearIdempotencyCache, getIdempotencyCacheSize } from "../../src/middleware/idempotency.js";

function createTestApp() {
	let callCount = 0;
	const app = new Hono();
	app.post("/test", idempotency(), (c) => {
		callCount++;
		return c.json({ result: "ok", callCount });
	});
	app.post("/other", idempotency(), (c) => {
		return c.json({ result: "other" });
	});
	return { app, getCallCount: () => callCount };
}

describe("idempotency middleware", () => {
	beforeEach(() => {
		clearIdempotencyCache();
	});

	it("executes handler normally without Idempotency-Key", async () => {
		const { app } = createTestApp();
		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("Idempotency-Replayed")).toBeNull();
		expect(getIdempotencyCacheSize()).toBe(0);
	});

	it("caches and replays response for same key", async () => {
		const { app, getCallCount } = createTestApp();
		const headers = {
			"Content-Type": "application/json",
			"Idempotency-Key": "unique-key-1",
		};
		const body = JSON.stringify({});

		// First call — executes handler
		const res1 = await app.request("/test", { method: "POST", headers, body });
		expect(res1.status).toBe(200);
		const body1 = await res1.json();
		expect(body1.callCount).toBe(1);
		expect(res1.headers.get("Idempotency-Replayed")).toBeNull();

		// Second call — replays cached response
		const res2 = await app.request("/test", { method: "POST", headers, body });
		expect(res2.status).toBe(200);
		const body2 = await res2.json();
		expect(body2.callCount).toBe(1); // Same as first call — not re-executed
		expect(res2.headers.get("Idempotency-Replayed")).toBe("true");

		// Handler was only called once
		expect(getCallCount()).toBe(1);
	});

	it("returns 422 when key reused on different endpoint", async () => {
		const { app } = createTestApp();
		const headers = {
			"Content-Type": "application/json",
			"Idempotency-Key": "shared-key",
		};
		const body = JSON.stringify({});

		// First call on /test
		const res1 = await app.request("/test", { method: "POST", headers, body });
		expect(res1.status).toBe(200);

		// Second call on /other with same key
		const res2 = await app.request("/other", { method: "POST", headers, body });
		expect(res2.status).toBe(422);
		const problem = await res2.json();
		expect(problem.code).toBe("IDEMPOTENCY_KEY_REUSE");
	});

	it("rejects keys longer than 256 characters", async () => {
		const { app } = createTestApp();
		const res = await app.request("/test", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Idempotency-Key": "x".repeat(257),
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
		const problem = await res.json();
		expect(problem.code).toBe("INVALID_IDEMPOTENCY_KEY");
	});

	it("different keys execute handler independently", async () => {
		const { app, getCallCount } = createTestApp();

		const res1 = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json", "Idempotency-Key": "key-a" },
			body: JSON.stringify({}),
		});
		const res2 = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json", "Idempotency-Key": "key-b" },
			body: JSON.stringify({}),
		});

		expect(res1.status).toBe(200);
		expect(res2.status).toBe(200);
		const body1 = await res1.json();
		const body2 = await res2.json();
		expect(body1.callCount).toBe(1);
		expect(body2.callCount).toBe(2);
		expect(getCallCount()).toBe(2);
	});

	it("clearIdempotencyCache resets state", async () => {
		const { app } = createTestApp();
		await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json", "Idempotency-Key": "key-c" },
			body: JSON.stringify({}),
		});
		expect(getIdempotencyCacheSize()).toBe(1);

		clearIdempotencyCache();
		expect(getIdempotencyCacheSize()).toBe(0);
	});
});
