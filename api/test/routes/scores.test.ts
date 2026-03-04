import { describe, expect, it, vi } from "vitest";
import { AUTH_HEADERS, authedHeaders } from "../helpers.js";

vi.mock("../../src/services/chain", () => ({
	getQovaClient: () => ({
		getTransactionStats: vi.fn().mockResolvedValue({
			totalCount: 156,
			totalVolume: 45200000000000000000n,
			successCount: 152,
			lastActivityTimestamp: 1708900000n,
		}),
		getBudgetStatus: vi.fn().mockResolvedValue({
			dailyRemaining: 6800000000000000000n,
			monthlyRemaining: 55000000000000000000n,
			perTxLimit: 5000000000000000000n,
			dailySpent: 3200000000000000000n,
			monthlySpent: 45000000000000000000n,
		}),
		getScore: vi.fn().mockResolvedValue(850),
	}),
}));

const { app } = await import("../../src/app.js");

const VALID_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("CRE-compatible endpoints", () => {
	it("GET /api/scores/agents returns agent list", async () => {
		const res = await app.request("/api/scores/agents", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.agents).toBeInstanceOf(Array);
		expect(body.agents.length).toBeGreaterThan(0);
	});

	it("POST /api/scores/enrich returns enrichment data", async () => {
		const res = await app.request("/api/scores/enrich", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: VALID_ADDRESS }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.sanctionsClean).toBe(true);
		expect(body.apiReputationScore).toBeTypeOf("number");
		expect(body.riskLevel).toBe("LOW");
	});

	it("POST /api/scores/anomaly-check returns anomaly result", async () => {
		const res = await app.request("/api/scores/anomaly-check", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				agent: VALID_ADDRESS,
				txHash: `0x${"ab".repeat(32)}`,
				amount: "1000000000",
				txType: 0,
			}),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("anomalyDetected");
		expect(body).toHaveProperty("riskScore");
		expect(body).toHaveProperty("flags");
	});
});

describe("POST /api/scores/compute", () => {
	it("computes score from raw metrics", async () => {
		const res = await app.request("/api/scores/compute", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				totalVolume: "100000000000000000000",
				transactionCount: 500,
				successRate: 9800,
				dailySpent: "1000000000000000000",
				dailyLimit: "10000000000000000000",
				accountAgeSeconds: 365 * 86400,
				sanctionsClean: true,
			}),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.score).toBeGreaterThan(0);
		expect(body.score).toBeLessThanOrEqual(1000);
		expect(body.grade).toBeTypeOf("string");
		expect(body.gradeColor).toMatch(/^#[A-Fa-f0-9]{6}$/);
	});
});

describe("GET /api/scores/:address", () => {
	it("returns full score breakdown", async () => {
		const res = await app.request(`/api/scores/${VALID_ADDRESS}`, { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.score).toBe(850);
		expect(body.grade).toBe("A");
		expect(body.factors).toBeDefined();
		expect(body.factors.transactionVolume).toBeDefined();
		expect(body.factors.successRate.weight).toBe(0.3);
		expect(body.timestamp).toBeDefined();
	});
});

describe("CRE /v1 backward-compatible endpoints", () => {
	it("GET /v1/agents returns same shape as mock API", async () => {
		const res = await app.request("/v1/agents", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.agents).toBeInstanceOf(Array);
	});

	it("POST /v1/enrich returns same shape as mock API", async () => {
		const res = await app.request("/v1/enrich", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: VALID_ADDRESS }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.sanctionsClean).toBe(true);
		expect(body.apiReputationScore).toBe(82);
	});

	it("POST /v1/anomaly-check returns same shape", async () => {
		const res = await app.request("/v1/anomaly-check", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.anomalyDetected).toBe(false);
	});

	it("POST /v1/sanctions/check returns same shape", async () => {
		const res = await app.request("/v1/sanctions/check", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.clean).toBe(true);
		expect(body.source).toBe("mock-ofac-sdn");
	});
});
