/**
 * Tests for the Qova HTTP SDK.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { Qova } from "../src/http/client.js";
import { QovaConfigError, QovaApiError, QovaAuthError, QovaNetworkError } from "../src/http/errors.js";

describe("Qova constructor", () => {
	it("throws QovaConfigError without API key", () => {
		expect(() => new Qova("")).toThrow(QovaConfigError);
	});

	it("throws QovaConfigError for invalid key format", () => {
		expect(() => new Qova("sk_live_abc123")).toThrow(QovaConfigError);
	});

	it("creates client with valid key", () => {
		const qova = new Qova("qova_test_abc123def456");
		expect(qova).toBeInstanceOf(Qova);
		expect(qova.agents).toBeDefined();
		expect(qova.scores).toBeDefined();
		expect(qova.transactions).toBeDefined();
		expect(qova.budgets).toBeDefined();
		expect(qova.keys).toBeDefined();
		expect(qova.webhooks).toBeDefined();
	});

	it("accepts custom options", () => {
		const qova = new Qova("qova_test_abc123def456", {
			baseUrl: "http://localhost:3000",
			timeout: 5000,
			maxRetries: 0,
			retryDelay: 500,
			headers: { "X-Custom": "value" },
		});
		expect(qova).toBeInstanceOf(Qova);
	});
});

describe("Resources", () => {
	const qova = new Qova("qova_test_abc123def456");

	it("agents has expected methods", () => {
		expect(typeof qova.agents.list).toBe("function");
		expect(typeof qova.agents.listAll).toBe("function");
		expect(typeof qova.agents.get).toBe("function");
		expect(typeof qova.agents.score).toBe("function");
		expect(typeof qova.agents.isRegistered).toBe("function");
		expect(typeof qova.agents.register).toBe("function");
		expect(typeof qova.agents.updateScore).toBe("function");
		expect(typeof qova.agents.batchUpdateScores).toBe("function");
	});

	it("scores has expected methods", () => {
		expect(typeof qova.scores.breakdown).toBe("function");
		expect(typeof qova.scores.compute).toBe("function");
		expect(typeof qova.scores.enrich).toBe("function");
		expect(typeof qova.scores.anomalyCheck).toBe("function");
	});

	it("budgets has expected methods", () => {
		expect(typeof qova.budgets.get).toBe("function");
		expect(typeof qova.budgets.set).toBe("function");
		expect(typeof qova.budgets.check).toBe("function");
		expect(typeof qova.budgets.recordSpend).toBe("function");
	});

	it("top-level verify and health exist", () => {
		expect(typeof qova.verify).toBe("function");
		expect(typeof qova.sanctionsCheck).toBe("function");
		expect(typeof qova.health).toBe("function");
	});
});

describe("HTTP requests", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	function mockFetch(status: number, body: unknown) {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			headers: new Headers(),
			json: async () => body,
			text: async () => JSON.stringify(body),
		});
	}

	it("sends correct auth header", async () => {
		mockFetch(200, { agents: [], total: 0 });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await qova.agents.list();
		const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((options.headers as Record<string, string>)["Authorization"]).toBe("Bearer qova_test_mykey123456");
	});

	it("sends User-Agent header", async () => {
		mockFetch(200, { agents: [], total: 0 });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await qova.agents.list();
		const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((options.headers as Record<string, string>)["User-Agent"]).toMatch(/^@qova\/core\//);
	});

	it("parses JSON response", async () => {
		mockFetch(200, { agent: "0xabc", score: 750, grade: "A" });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		const result = await qova.agents.score("0xabc");
		expect(result).toEqual({ agent: "0xabc", score: 750, grade: "A" });
	});

	it("throws QovaAuthError on 401", async () => {
		mockFetch(401, { error: "Invalid API key" });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await expect(qova.agents.list()).rejects.toThrow(QovaAuthError);
	});

	it("throws QovaAuthError on 403", async () => {
		mockFetch(403, { error: "Insufficient scope" });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await expect(qova.agents.list()).rejects.toThrow(QovaAuthError);
	});

	it("throws QovaApiError on 400 with code", async () => {
		mockFetch(400, { error: "Invalid address", code: "INVALID_ADDRESS" });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		try {
			await qova.agents.score("bad");
			expect.unreachable("Should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(QovaApiError);
			expect((e as QovaApiError).status).toBe(400);
			expect((e as QovaApiError).code).toBe("INVALID_ADDRESS");
		}
	});

	it("throws QovaNetworkError on fetch failure", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await expect(qova.health()).rejects.toThrow(QovaNetworkError);
	});

	it("sends POST body as JSON", async () => {
		mockFetch(200, { txHash: "0x123", agent: "0xabc" });
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await qova.agents.register("0xabc");
		const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(options.method).toBe("POST");
		expect(JSON.parse(options.body as string)).toEqual({ agent: "0xabc" });
	});

	it("retries on 500", async () => {
		let calls = 0;
		globalThis.fetch = vi.fn().mockImplementation(async () => {
			calls++;
			if (calls === 1) return { ok: false, status: 500, headers: new Headers(), json: async () => ({}) };
			return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ status: "ok" }) };
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 2, retryDelay: 10 });
		const result = await qova.health();
		expect(result.status).toBe("ok");
		expect(calls).toBe(2);
	});
});

describe("Error classes", () => {
	it("QovaApiError has status and code", () => {
		const err = new QovaApiError("bad request", 400, "BAD_REQUEST", { detail: "x" });
		expect(err.name).toBe("QovaApiError");
		expect(err.status).toBe(400);
		expect(err.code).toBe("BAD_REQUEST");
		expect(err.body).toEqual({ detail: "x" });
	});

	it("QovaAuthError defaults to 401", () => {
		const err = new QovaAuthError("no key");
		expect(err.status).toBe(401);
	});

	it("QovaNetworkError includes cause", () => {
		const cause = new Error("ECONNREFUSED");
		const err = new QovaNetworkError("fail", cause);
		expect(err.cause).toBe(cause);
	});

	it("QovaConfigError is Error", () => {
		const err = new QovaConfigError("missing");
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("QovaConfigError");
	});
});

describe("Interceptors", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	function mockFetch(status: number, body: unknown) {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			headers: new Headers({ "x-request-id": "test-123" }),
			json: async () => body,
			text: async () => JSON.stringify(body),
		});
	}

	it("fires onRequest before each request", async () => {
		mockFetch(200, { status: "ok" });
		const calls: string[] = [];
		const qova = new Qova("qova_test_mykey123456", {
			baseUrl: "http://localhost:3000",
			maxRetries: 0,
			onRequest: (req) => { calls.push(`${req.method} ${req.url}`); },
		});
		await qova.health();
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain("GET");
		expect(calls[0]).toContain("/api/health");
	});

	it("fires onResponse after each request", async () => {
		mockFetch(200, { status: "ok" });
		const calls: number[] = [];
		const qova = new Qova("qova_test_mykey123456", {
			baseUrl: "http://localhost:3000",
			maxRetries: 0,
			onResponse: (res) => { calls.push(res.status); },
		});
		await qova.health();
		expect(calls).toEqual([200]);
	});

	it("interceptor errors do not break requests", async () => {
		mockFetch(200, { status: "ok" });
		const qova = new Qova("qova_test_mykey123456", {
			baseUrl: "http://localhost:3000",
			maxRetries: 0,
			onRequest: () => { throw new Error("interceptor crash"); },
			onResponse: () => { throw new Error("interceptor crash"); },
		});
		const result = await qova.health();
		expect(result.status).toBe("ok");
	});
});

describe("Idempotency keys", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	it("sends Idempotency-Key header when provided", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => JSON.stringify({ txHash: "0x123", agent: "0xabc" }),
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await qova.agents.register("0xabc", { idempotencyKey: "my-unique-key" });
		const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((options.headers as Record<string, string>)["Idempotency-Key"]).toBe("my-unique-key");
	});

	it("does not send Idempotency-Key when not provided", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => JSON.stringify({ txHash: "0x123", agent: "0xabc" }),
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await qova.agents.register("0xabc");
		const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((options.headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();
	});
});

describe("RFC 7807 error parsing", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	it("extracts detail from RFC 7807 response", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			headers: new Headers(),
			json: async () => ({
				type: "https://api.qova.cc/errors/INVALID_ADDRESS",
				title: "Invalid Ethereum Address",
				status: 400,
				detail: "Parameter address must be a valid hex address",
				code: "INVALID_ADDRESS",
			}),
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		try {
			await qova.agents.score("bad");
			expect.unreachable("Should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(QovaApiError);
			const err = e as QovaApiError;
			expect(err.message).toBe("Parameter address must be a valid hex address");
			expect(err.code).toBe("INVALID_ADDRESS");
			expect(err.status).toBe(400);
		}
	});

	it("falls back to legacy error format", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			headers: new Headers(),
			json: async () => ({ error: "old format", code: "LEGACY" }),
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		try {
			await qova.agents.score("bad");
			expect.unreachable("Should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(QovaApiError);
			const err = e as QovaApiError;
			expect(err.message).toBe("old format");
			expect(err.code).toBe("LEGACY");
		}
	});
});

describe("Pagination", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	it("list() sends pagination query params", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => JSON.stringify({ data: [{ address: "0x1", score: 800, isRegistered: true }], pagination: { total: 1, limit: 5, hasMore: false, nextCursor: null } }),
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		await qova.agents.list({ limit: 5, cursor: "0xabc", sort: "asc" });
		const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toContain("limit=5");
		expect(url).toContain("cursor=0xabc");
		expect(url).toContain("sort=asc");
	});

	it("listAll() auto-paginates through all pages", async () => {
		let callCount = 0;
		globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
			callCount++;
			const hasCursor = url.includes("cursor=");
			const data = hasCursor
				? [{ address: "0x3", score: 700, isRegistered: true }, { address: "0x4", score: 600, isRegistered: false }]
				: [{ address: "0x1", score: 900, isRegistered: true }, { address: "0x2", score: 800, isRegistered: true }];
			const hasMore = !hasCursor;
			const nextCursor = hasMore ? "0x2" : null;
			return {
				ok: true,
				status: 200,
				headers: new Headers(),
				text: async () => JSON.stringify({
					data,
					pagination: { total: 4, limit: 2, hasMore, nextCursor },
				}),
			};
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		const all = await qova.agents.listAll({ limit: 2 }).toArray();
		expect(all.map((a) => a.address)).toEqual(["0x1", "0x2", "0x3", "0x4"]);
		expect(callCount).toBe(2);
	});

	it("listAll().take(n) stops early", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => JSON.stringify({
				data: [
					{ address: "0x1", score: 900, isRegistered: true },
					{ address: "0x2", score: 800, isRegistered: true },
					{ address: "0x3", score: 700, isRegistered: false },
				],
				pagination: { total: 10, limit: 3, hasMore: true, nextCursor: "0x3" },
			}),
		});
		const qova = new Qova("qova_test_mykey123456", { baseUrl: "http://localhost:3000", maxRetries: 0 });
		const first2 = await qova.agents.listAll({ limit: 3 }).take(2);
		expect(first2.map((a) => a.address)).toEqual(["0x1", "0x2"]);
	});
});
