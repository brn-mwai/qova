import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
	AgentNotRegisteredError,
	BudgetExceededError,
	InvalidScoreError,
	QovaError,
	UnauthorizedError,
} from "@qova/core";
import { errorHandler } from "../../src/middleware/error.js";

function createTestApp(error: Error): Hono {
	const app = new Hono();
	app.onError(errorHandler);
	app.get("/test", () => {
		throw error;
	});
	return app;
}

describe("errorHandler", () => {
	it("maps AgentNotRegisteredError to 404", async () => {
		const app = createTestApp(new AgentNotRegisteredError("0x123"));
		const res = await app.request("/test");
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("AGENT_NOT_REGISTERED");
	});

	it("maps BudgetExceededError to 422", async () => {
		const app = createTestApp(new BudgetExceededError("0x123"));
		const res = await app.request("/test");
		expect(res.status).toBe(422);
		expect((await res.json()).code).toBe("BUDGET_EXCEEDED");
	});

	it("maps UnauthorizedError to 403", async () => {
		const app = createTestApp(new UnauthorizedError());
		const res = await app.request("/test");
		expect(res.status).toBe(403);
		expect((await res.json()).code).toBe("UNAUTHORIZED");
	});

	it("maps InvalidScoreError to 400", async () => {
		const app = createTestApp(new InvalidScoreError(9999));
		const res = await app.request("/test");
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("INVALID_SCORE");
	});

	it("maps generic QovaError to 500", async () => {
		const app = createTestApp(new QovaError("test", "TEST_ERROR"));
		const res = await app.request("/test");
		expect(res.status).toBe(500);
		expect((await res.json()).code).toBe("TEST_ERROR");
	});

	it("maps unknown errors to 500", async () => {
		const app = createTestApp(new Error("unknown"));
		const res = await app.request("/test");
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.code).toBe("INTERNAL_ERROR");
		expect(body.type).toContain("INTERNAL_ERROR");
		expect(body.status).toBe(500);
	});
});
