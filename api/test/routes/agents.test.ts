import { describe, expect, it, vi } from "vitest";
import { AUTH_HEADERS, authedHeaders } from "../helpers.js";

vi.mock("../../src/services/chain", () => ({
	getQovaClient: () => ({
		getAgentDetails: vi.fn().mockResolvedValue({
			score: 850,
			lastUpdated: 1708900000n,
			updateCount: 12,
			isRegistered: true,
		}),
		getScore: vi.fn().mockResolvedValue(850),
		isAgentRegistered: vi.fn().mockResolvedValue(true),
		registerAgent: vi.fn().mockResolvedValue("0xabcdef1234567890"),
		updateScore: vi.fn().mockResolvedValue("0xabcdef1234567890"),
		batchUpdateScores: vi.fn().mockResolvedValue("0xabcdef1234567890"),
	}),
}));

const { app } = await import("../../src/app.js");

const VALID_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("GET /api/agents/:address", () => {
	it("returns enriched agent details", async () => {
		const res = await app.request(`/api/agents/${VALID_ADDRESS}`, { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.score).toBe(850);
		expect(body.grade).toBe("A");
		expect(body.gradeColor).toBe("#22C55E");
		expect(body.isRegistered).toBe(true);
		expect(body.scoreFormatted).toBe("0850");
		expect(body.scorePercentage).toBe(85);
		expect(body.addressShort).toContain("...");
	});

	it("returns 400 for invalid address", async () => {
		const res = await app.request("/api/agents/not-an-address", { headers: AUTH_HEADERS });
		expect(res.status).toBe(400);
	});
});

describe("GET /api/agents/:address/score", () => {
	it("returns score with grade and color", async () => {
		const res = await app.request(
			`/api/agents/${VALID_ADDRESS}/score`,
			{ headers: AUTH_HEADERS },
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.score).toBe(850);
		expect(body.grade).toBe("A");
		expect(body.gradeColor).toMatch(/^#[A-Fa-f0-9]{6}$/);
	});
});

describe("GET /api/agents/:address/registered", () => {
	it("returns registration status", async () => {
		const res = await app.request(
			`/api/agents/${VALID_ADDRESS}/registered`,
			{ headers: AUTH_HEADERS },
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.isRegistered).toBe(true);
	});
});

describe("GET /api/agents", () => {
	it("returns agent list with pagination", async () => {
		const res = await app.request("/api/agents", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toBeInstanceOf(Array);
		expect(body.pagination).toBeDefined();
		expect(body.pagination.total).toBeGreaterThan(0);
		expect(body.pagination.limit).toBe(20);
		expect(typeof body.pagination.hasMore).toBe("boolean");
	});

	it("respects limit param", async () => {
		const res = await app.request("/api/agents?limit=2", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.length).toBeLessThanOrEqual(2);
		expect(body.pagination.limit).toBe(2);
	});

	it("filters by registered=true", async () => {
		const res = await app.request("/api/agents?registered=true", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		// All returned agents should be registered (mock data has mix)
		expect(body.data.every((a: { isRegistered: boolean }) => a.isRegistered)).toBe(true);
	});

	it("filters by min_score", async () => {
		const res = await app.request("/api/agents?min_score=700", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.every((a: { score: number }) => a.score >= 700)).toBe(true);
	});

	it("filters by max_score", async () => {
		const res = await app.request("/api/agents?max_score=500", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.every((a: { score: number }) => a.score <= 500)).toBe(true);
	});

	it("sorts ascending", async () => {
		const res = await app.request("/api/agents?sort=asc", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		const scores = body.data.map((a: { score: number }) => a.score);
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
		}
	});

	it("supports field selection", async () => {
		const res = await app.request("/api/agents?fields=address,score", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		const first = body.data[0];
		expect(first.address).toBeDefined();
		expect(first.score).toBeDefined();
		expect(first.isRegistered).toBeUndefined();
	});
});

describe("POST /api/agents/register", () => {
	it("registers a new agent", async () => {
		const res = await app.request("/api/agents/register", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: VALID_ADDRESS }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.txHash).toBeDefined();
		expect(body.agent).toBe(VALID_ADDRESS);
	});

	it("returns 400 for invalid address in body", async () => {
		const res = await app.request("/api/agents/register", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: "invalid" }),
		});
		expect(res.status).toBe(400);
	});
});
