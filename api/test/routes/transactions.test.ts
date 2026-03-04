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
		recordTransaction: vi.fn().mockResolvedValue("0xabcdef1234567890"),
	}),
}));

const { app } = await import("../../src/app.js");

const VALID_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("GET /api/transactions/:address/stats", () => {
	it("returns enriched transaction stats", async () => {
		const res = await app.request(
			`/api/transactions/${VALID_ADDRESS}/stats`,
			{ headers: AUTH_HEADERS },
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.totalCount).toBe(156);
		expect(body.totalVolume).toContain("ETH");
		expect(body.successRate).toContain("%");
		expect(body.addressShort).toContain("...");
	});
});

describe("POST /api/transactions/record", () => {
	it("records a transaction", async () => {
		const res = await app.request("/api/transactions/record", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				agent: VALID_ADDRESS,
				txHash: `0x${"ab".repeat(32)}`,
				amount: "1000000000000000000",
				txType: 0,
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.txHash).toBeDefined();
	});
});
