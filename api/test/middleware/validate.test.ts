import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { validateAddress, validateBody } from "../../src/middleware/validate.js";

describe("validateAddress", () => {
	const app = new Hono();
	app.get("/:address", validateAddress(), (c) =>
		c.json({ valid: true }),
	);

	it("passes for valid address", async () => {
		const res = await app.request(
			"/0x0000000000000000000000000000000000000001",
		);
		expect(res.status).toBe(200);
	});

	it("rejects invalid address", async () => {
		const res = await app.request("/not-an-address");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("INVALID_ADDRESS");
		expect(body.type).toContain("INVALID_ADDRESS");
	});

	it("rejects short address", async () => {
		const res = await app.request("/0x1234");
		expect(res.status).toBe(400);
	});
});

describe("validateBody", () => {
	const schema = z.object({
		name: z.string().min(1),
		value: z.number().int().positive(),
	});
	const app = new Hono();
	app.post("/test", validateBody(schema), (c) => {
		const body = c.get("body");
		return c.json(body);
	});

	it("passes valid body", async () => {
		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "test", value: 42 }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.name).toBe("test");
	});

	it("rejects invalid body", async () => {
		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "", value: -1 }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("VALIDATION_ERROR");
		expect(body.errors).toBeInstanceOf(Array);
		expect(body.errors[0].field).toBeDefined();
		expect(body.errors[0].message).toBeDefined();
	});

	it("rejects non-JSON body", async () => {
		const res = await app.request("/test", {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: "not json",
		});
		expect(res.status).toBe(400);
	});
});
