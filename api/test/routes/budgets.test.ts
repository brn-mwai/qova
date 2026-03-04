import { describe, expect, it, vi } from "vitest";
import { AUTH_HEADERS, authedHeaders } from "../helpers.js";

vi.mock("../../src/services/chain", () => ({
	getQovaClient: () => ({
		getBudgetStatus: vi.fn().mockResolvedValue({
			dailyRemaining: 6800000000000000000n,
			monthlyRemaining: 55000000000000000000n,
			perTxLimit: 5000000000000000000n,
			dailySpent: 3200000000000000000n,
			monthlySpent: 45000000000000000000n,
		}),
		setBudget: vi.fn().mockResolvedValue("0xabcdef1234567890"),
		checkBudget: vi.fn().mockResolvedValue(true),
		recordSpend: vi.fn().mockResolvedValue("0xabcdef1234567890"),
	}),
}));

const { app } = await import("../../src/app.js");

const VALID_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("GET /api/budgets/:address", () => {
	it("returns enriched budget status", async () => {
		const res = await app.request(`/api/budgets/${VALID_ADDRESS}`, { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.config.dailyLimit).toContain("ETH");
		expect(body.usage.dailySpent).toContain("ETH");
		expect(body.utilization.daily).toContain("%");
		expect(body.raw.dailyLimit).toBeDefined();
	});
});

describe("POST /api/budgets/:address/check", () => {
	it("checks budget for amount", async () => {
		const res = await app.request(
			`/api/budgets/${VALID_ADDRESS}/check`,
			{
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ amount: "1000000000000000000" }),
			},
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.withinBudget).toBe(true);
	});
});
