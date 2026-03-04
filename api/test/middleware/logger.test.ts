/**
 * Tests for request logging middleware.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { requestLogger } from "../../src/middleware/logger.js";

describe("requestLogger middleware", () => {
	it("sets X-Request-Id header", async () => {
		const app = new Hono();
		app.use("/*", requestLogger());
		app.get("/test", (c) => c.json({ ok: true }));

		const res = await app.request("/test");
		expect(res.status).toBe(200);
		expect(res.headers.get("X-Request-Id")).toBeTruthy();
	});

	it("preserves incoming X-Request-Id", async () => {
		const app = new Hono();
		app.use("/*", requestLogger());
		app.get("/test", (c) => c.json({ ok: true }));

		const res = await app.request("/test", {
			headers: { "X-Request-Id": "my-custom-id" },
		});
		expect(res.headers.get("X-Request-Id")).toBe("my-custom-id");
	});

	it("logs request details as JSON", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const app = new Hono();
		app.use("/*", requestLogger());
		app.get("/test", (c) => c.json({ ok: true }));

		await app.request("/test");

		expect(logSpy).toHaveBeenCalledOnce();
		const logged = JSON.parse(logSpy.mock.calls[0][0]);
		expect(logged.method).toBe("GET");
		expect(logged.path).toBe("/test");
		expect(logged.status).toBe(200);
		expect(logged.level).toBe("info");
		expect(logged.duration).toBeGreaterThanOrEqual(0);
		expect(logged.requestId).toBeTruthy();

		logSpy.mockRestore();
	});

	it("logs 4xx as warn level", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const app = new Hono();
		app.use("/*", requestLogger());
		app.get("/test", (c) => c.json({ error: "not found" }, 404));

		await app.request("/test");

		expect(warnSpy).toHaveBeenCalledOnce();
		const logged = JSON.parse(warnSpy.mock.calls[0][0]);
		expect(logged.level).toBe("warn");
		expect(logged.status).toBe(404);

		warnSpy.mockRestore();
	});

	it("logs 5xx as error level", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const app = new Hono();
		app.use("/*", requestLogger());
		app.get("/test", (c) => c.json({ error: "internal" }, 500));

		await app.request("/test");

		expect(errorSpy).toHaveBeenCalledOnce();
		const logged = JSON.parse(errorSpy.mock.calls[0][0]);
		expect(logged.level).toBe("error");
		expect(logged.status).toBe(500);

		errorSpy.mockRestore();
	});
});
