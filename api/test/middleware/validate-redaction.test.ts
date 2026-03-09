/**
 * Validation error redaction tests.
 * Covers Fix 2.4: Production error detail redaction.
 * @author Qova Engineering <eng@qova.cc>
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { validateBody } from "../../src/middleware/validate.js";

const schema = z.object({
	name: z.string().min(1),
	value: z.number().int().positive(),
});

describe("validation error redaction (Fix 2.4)", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.NODE_ENV;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalEnv;
		}
	});

	it("returns full Zod issues in development", async () => {
		process.env.NODE_ENV = "development";
		const app = new Hono();
		app.post("/test", validateBody(schema), (c) => c.json(c.get("body")));

		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "", value: -1 }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Validation failed");
		// In dev, details should contain full Zod issue objects (with code, etc.)
		expect(body.details).toBeInstanceOf(Array);
		expect(body.details.length).toBeGreaterThan(0);
		// Full Zod issues include 'code' field
		expect(body.details[0]).toHaveProperty("code");
	});

	it("redacts schema details in production", async () => {
		process.env.NODE_ENV = "production";
		const app = new Hono();
		app.post("/test", validateBody(schema), (c) => c.json(c.get("body")));

		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "", value: -1 }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeInstanceOf(Array);
		expect(body.details.length).toBeGreaterThan(0);
		// Redacted: only path + message, no code/expected/received/etc.
		const detail = body.details[0];
		expect(detail).toHaveProperty("path");
		expect(detail).toHaveProperty("message");
		expect(detail).not.toHaveProperty("code");
		expect(detail).not.toHaveProperty("expected");
	});
});
