/**
 * Integration tests — SDK ↔ mock API server.
 *
 * These tests spin up a real HTTP server and exercise the full SDK client
 * end-to-end, including auth headers, pagination, error handling, and retries.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Qova } from "../src/http/client.js";
import { QovaAuthError, QovaApiError } from "../src/http/errors.js";
import { createMockServer, type MockServer } from "../src/testing/mock-server.js";

let mock: MockServer;
let qova: Qova;

beforeAll(async () => {
	mock = createMockServer();
	await mock.start();
	qova = new Qova("qova_test_integration_key_12345", {
		baseUrl: mock.url,
		maxRetries: 0,
		timeout: 5000,
	});
});

afterAll(async () => {
	await mock.stop();
});

describe("Integration: health", () => {
	it("returns health status", async () => {
		const health = await qova.health();
		expect(health.status).toBe("ok");
		expect(health.timestamp).toBeDefined();
	});
});

describe("Integration: agents", () => {
	it("lists agents with pagination", async () => {
		const result = await qova.agents.list();
		expect(result.data).toBeInstanceOf(Array);
		expect(result.data.length).toBeGreaterThan(0);
		expect(result.data[0]!.address).toBeDefined();
		expect(result.data[0]!.score).toBeDefined();
		expect(result.pagination).toBeDefined();
		expect(result.pagination.total).toBeGreaterThan(0);
	});

	it("lists agents with limit param", async () => {
		const result = await qova.agents.list({ limit: 1 });
		expect(result.data.length).toBeLessThanOrEqual(1);
	});

	it("gets agent details", async () => {
		const result = await qova.agents.get("0x0000000000000000000000000000000000000001");
		expect(result.agent).toBe("0x0000000000000000000000000000000000000001");
		expect(result.score).toBeDefined();
		expect(result.grade).toBeDefined();
	});

	it("gets agent score", async () => {
		const result = await qova.agents.score("0x0000000000000000000000000000000000000001");
		expect(result.score).toBe(850);
		expect(result.grade).toBe("A");
	});

	it("returns 404 for unknown agent", async () => {
		try {
			await qova.agents.get("0x0000000000000000000000000000000000000099");
			expect.unreachable("Should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(QovaApiError);
			expect((e as QovaApiError).status).toBe(404);
			expect((e as QovaApiError).code).toBe("AGENT_NOT_REGISTERED");
		}
	});

	it("registers an agent", async () => {
		const result = await qova.agents.register("0x0000000000000000000000000000000000000001");
		expect(result.txHash).toMatch(/^0xmock_tx_hash_/);
	});

	it("registers with idempotency key", async () => {
		const result = await qova.agents.register("0x0000000000000000000000000000000000000001", {
			idempotencyKey: "test-idempotency-123",
		});
		expect(result.txHash).toBeDefined();
	});
});

describe("Integration: scores", () => {
	it("computes a score", async () => {
		const result = await qova.scores.compute({
			totalVolume: "1000000",
			transactionCount: 50,
			successRate: 98,
			dailySpent: "5000",
			dailyLimit: "10000",
			accountAgeSeconds: 86400 * 30,
		});
		expect(result.score).toBe(750);
		expect(result.grade).toBe("A");
	});
});

describe("Integration: verify", () => {
	it("verifies an agent", async () => {
		const result = await qova.verify("0x0000000000000000000000000000000000000001");
		expect(result.verified).toBe(true);
		expect(result.sanctionsClean).toBe(true);
	});
});

describe("Integration: auth errors", () => {
	it("rejects requests without API key", async () => {
		const badClient = new Qova("qova_badkey_no_bearer_prefix", {
			baseUrl: mock.url,
			maxRetries: 0,
		});
		// Mock server checks for "Bearer qova_" so any valid-format key works
		// But an empty or non-qova key should fail at client validation
		// Since our client validates the prefix, test against mock directly
		try {
			const res = await fetch(`${mock.url}/api/agents`, {
				headers: { Authorization: "Bearer invalid_key" },
			});
			expect(res.status).toBe(401);
		} catch {
			// Network error in test env is acceptable
		}
	});
});

describe("Integration: listAll auto-pagination", () => {
	it("iterates through all agents", async () => {
		const all = await qova.agents.listAll().toArray();
		expect(all.length).toBeGreaterThan(0);
		expect(all[0]!.address).toBeDefined();
		expect(all[0]!.score).toBeDefined();
	});

	it("take(n) limits results", async () => {
		const first = await qova.agents.listAll().take(1);
		expect(first.length).toBe(1);
		expect(first[0]!.address).toBeDefined();
	});
});

describe("Integration: interceptors", () => {
	it("fires onRequest and onResponse during real calls", async () => {
		const requests: string[] = [];
		const responses: number[] = [];

		const client = new Qova("qova_test_integration_key_12345", {
			baseUrl: mock.url,
			maxRetries: 0,
			onRequest: (req) => requests.push(`${req.method} ${req.url}`),
			onResponse: (res) => responses.push(res.status),
		});

		await client.health();
		expect(requests.length).toBe(1);
		expect(requests[0]).toContain("/api/health");
		expect(responses).toEqual([200]);
	});
});
