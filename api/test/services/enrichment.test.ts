import { describe, expect, it } from "vitest";
import {
	enrichAgentDetails,
	enrichBudgetStatus,
	enrichTransactionStats,
} from "../../src/services/enrichment.js";

const ADDR = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";

describe("enrichAgentDetails", () => {
	it("enriches raw agent details with SDK utils", () => {
		const result = enrichAgentDetails(ADDR, {
			score: 850,
			lastUpdated: 1708900000n,
			updateCount: 12,
			isRegistered: true,
		});

		expect(result.agent).toBe(ADDR);
		expect(result.score).toBe(850);
		expect(result.grade).toBe("A");
		expect(result.gradeColor).toBe("#22C55E");
		expect(result.scoreFormatted).toBe("0850");
		expect(result.scorePercentage).toBe(85);
		expect(result.isRegistered).toBe(true);
		expect(result.addressShort).toContain("...");
		expect(result.explorerUrl).toContain("basescan.org");
	});
});

describe("enrichTransactionStats", () => {
	it("enriches raw transaction stats", () => {
		const result = enrichTransactionStats(ADDR, {
			totalCount: 156,
			totalVolume: 45200000000000000000n,
			successCount: 152,
			lastActivityTimestamp: 1708900000n,
		});

		expect(result.totalCount).toBe(156);
		expect(result.totalVolume).toContain("USDC.e");
		expect(result.successRate).toContain("%");
		expect(result.addressShort).toContain("...");
	});
});

describe("enrichBudgetStatus", () => {
	it("enriches raw budget status with utilization", () => {
		const result = enrichBudgetStatus(ADDR, {
			dailyRemaining: 6800000000000000000n,
			monthlyRemaining: 55000000000000000000n,
			perTxLimit: 5000000000000000000n,
			dailySpent: 3200000000000000000n,
			monthlySpent: 45000000000000000000n,
		});

		expect(result.config).toBeDefined();
		expect(result.usage).toBeDefined();
		expect(result.utilization).toBeDefined();
		expect(result.raw).toBeDefined();
		const config = result.config as Record<string, string>;
		expect(config.dailyLimit).toContain("USDC.e");
		const util = result.utilization as Record<string, string>;
		expect(util.daily).toContain("%");
	});
});
