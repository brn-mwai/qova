/**
 * Tests for API key authentication middleware.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { apiKeyAuth, clearKeyCache, API_SCOPES, type ApiKeyInfo } from "../../src/middleware/auth.js";

/** Mock validator that accepts known test keys. */
const VALID_KEY_HASH = "a]test-hash"; // doesn't matter, we intercept before hashing
const TEST_KEY_INFO: ApiKeyInfo = {
	userId: "user-123",
	name: "Test Key",
	scopes: [API_SCOPES.AGENTS_READ, API_SCOPES.SCORES_READ],
	keyPrefix: "qova_test_xx",
};

const ADMIN_KEY_INFO: ApiKeyInfo = {
	userId: "admin-1",
	name: "Admin Key",
	scopes: [API_SCOPES.ADMIN],
	keyPrefix: "qova_admin_x",
};

function mockValidator(validKeys: Map<string, ApiKeyInfo>) {
	return async (keyHash: string): Promise<ApiKeyInfo | null> => {
		// In real usage the hash is checked; here we just check all entries
		for (const info of validKeys.values()) {
			return info;
		}
		return null;
	};
}

function createTestApp(options: Parameters<typeof apiKeyAuth>[0] = {}): Hono {
	const app = new Hono();
	const validKeys = new Map<string, ApiKeyInfo>();
	validKeys.set("any", TEST_KEY_INFO);

	app.use(
		"/protected/*",
		apiKeyAuth({
			validator: mockValidator(validKeys),
			...options,
		}),
	);

	app.get("/protected/test", (c) => c.json({ ok: true }));
	app.get("/public/test", (c) => c.json({ ok: true }));

	return app;
}

describe("apiKeyAuth middleware", () => {
	beforeEach(() => {
		clearKeyCache();
	});

	it("rejects requests without Authorization header", async () => {
		const app = createTestApp();
		const res = await app.request("/protected/test");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.code).toBe("UNAUTHORIZED");
	});

	it("rejects requests with non-Bearer auth", async () => {
		const app = createTestApp();
		const res = await app.request("/protected/test", {
			headers: { Authorization: "Basic abc123" },
		});
		expect(res.status).toBe(401);
	});

	it("rejects requests with non-qova_ prefixed keys", async () => {
		const app = createTestApp();
		const res = await app.request("/protected/test", {
			headers: { Authorization: "Bearer sk_test_12345678901234567890" },
		});
		expect(res.status).toBe(401);
	});

	it("rejects short API keys", async () => {
		const app = createTestApp();
		const res = await app.request("/protected/test", {
			headers: { Authorization: "Bearer qova_short" },
		});
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.code).toBe("INVALID_KEY");
	});

	it("accepts valid API keys", async () => {
		const app = createTestApp();
		const res = await app.request("/protected/test", {
			headers: { Authorization: "Bearer qova_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
	});

	it("allows unauthenticated requests to public routes", async () => {
		const app = createTestApp();
		const res = await app.request("/public/test");
		expect(res.status).toBe(200);
	});

	it("allows unauthenticated when optional=true", async () => {
		const app = new Hono();
		app.use(
			"/optional/*",
			apiKeyAuth({
				optional: true,
				validator: async () => null,
			}),
		);
		app.get("/optional/test", (c) => c.json({ ok: true }));

		const res = await app.request("/optional/test");
		expect(res.status).toBe(200);
	});

	it("returns 403 when scope is insufficient", async () => {
		const app = new Hono();
		const validKeys = new Map([["any", TEST_KEY_INFO]]); // has agents:read, scores:read
		app.use(
			"/write/*",
			apiKeyAuth({
				scope: API_SCOPES.AGENTS_WRITE, // requires agents:write
				validator: mockValidator(validKeys),
			}),
		);
		app.post("/write/test", (c) => c.json({ ok: true }));

		const res = await app.request("/write/test", {
			method: "POST",
			headers: { Authorization: "Bearer qova_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
		});
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.code).toBe("FORBIDDEN");
	});

	it("admin scope grants access to everything", async () => {
		const app = new Hono();
		const validKeys = new Map([["any", ADMIN_KEY_INFO]]);
		app.use(
			"/write/*",
			apiKeyAuth({
				scope: API_SCOPES.AGENTS_WRITE,
				validator: mockValidator(validKeys),
			}),
		);
		app.post("/write/test", (c) => c.json({ ok: true }));

		const res = await app.request("/write/test", {
			method: "POST",
			headers: { Authorization: "Bearer qova_admin_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
		});
		expect(res.status).toBe(200);
	});
});
