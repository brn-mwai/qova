import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { metricsCollector, metricsRoutes, resetMetrics } from "../../src/middleware/metrics.js";

function createApp() {
	const app = new Hono();
	app.use("/*", metricsCollector());
	app.get("/test", (c) => c.json({ ok: true }));
	app.get("/error", (c) => c.json({ error: "bad" }, 400));
	app.get("/server-error", () => { throw new Error("crash"); });
	app.route("/metrics", metricsRoutes);
	return app;
}

describe("metricsCollector", () => {
	beforeEach(() => resetMetrics());

	it("counts requests", async () => {
		const app = createApp();
		await app.request("/test");
		await app.request("/test");

		const res = await app.request("/metrics");
		const text = await res.text();
		// 2 /test requests + 1 /metrics request = 3 total
		expect(text).toContain("qova_http_requests_total 3");
	});

	it("tracks per-route metrics", async () => {
		const app = createApp();
		await app.request("/test");

		const res = await app.request("/metrics");
		const text = await res.text();
		expect(text).toContain('method="GET"');
		expect(text).toContain('path="/test"');
		expect(text).toContain('status="2xx"');
	});

	it("counts error responses", async () => {
		const app = createApp();
		await app.request("/error");

		const res = await app.request("/metrics");
		const text = await res.text();
		expect(text).toContain("qova_http_errors_total 1");
	});

	it("includes histogram buckets", async () => {
		const app = createApp();
		await app.request("/test");

		const res = await app.request("/metrics");
		const text = await res.text();
		expect(text).toContain("le=");
		expect(text).toContain("_bucket");
		expect(text).toContain("_sum");
		expect(text).toContain("_count");
	});

	it("serves Prometheus content type", async () => {
		const app = createApp();
		const res = await app.request("/metrics");
		expect(res.headers.get("content-type")).toContain("text/plain");
	});

	it("includes uptime metric", async () => {
		const app = createApp();
		const res = await app.request("/metrics");
		const text = await res.text();
		expect(text).toContain("qova_process_uptime_seconds");
	});

	it("normalizes addresses in paths", async () => {
		const app = new Hono();
		app.use("/*", metricsCollector());
		app.get("/agents/:address", (c) => c.json({ ok: true }));
		app.route("/metrics", metricsRoutes);

		await app.request("/agents/0x0000000000000000000000000000000000000001");

		const res = await app.request("/metrics");
		const text = await res.text();
		expect(text).toContain(":address");
		expect(text).not.toContain("0x0000000000000000000000000000000000000001");
	});

	it("resets cleanly", async () => {
		const app = createApp();
		await app.request("/test");
		resetMetrics();

		const res = await app.request("/metrics");
		const text = await res.text();
		// After reset + 1 metrics request, total should be 1
		expect(text).toContain("qova_http_requests_total 1");
	});
});
