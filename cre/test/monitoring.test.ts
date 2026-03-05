import { describe, expect, it } from "bun:test";
import {
	classifyRiskSeverity,
	computeAccountAgeDays,
	computeAnomalyReport,
	computeAverageTxValue,
	computeBaselineFrequency,
	computeFailureRate,
	type MonitoringMetrics,
} from "../shared/monitoring";

/** Helper: create base metrics with sensible defaults */
function baseMetrics(overrides: Partial<MonitoringMetrics> = {}): MonitoringMetrics {
	const now = Math.floor(Date.now() / 1000);
	return {
		totalCount: 100,
		successCount: 95,
		totalVolume: BigInt(50e18),
		latestTxValue: BigInt(0.5e18),
		latestTxTimestamp: now,
		firstActivityTimestamp: now - 90 * 86400,
		interactedWithFlagged: false,
		currentTimestamp: now,
		...overrides,
	};
}

describe("computeAnomalyReport", () => {
	it("returns low risk for a normal agent", () => {
		const metrics = baseMetrics();
		const result = computeAnomalyReport(metrics);

		expect(result.riskScore).toBeLessThanOrEqual(25);
		expect(result.severity).toBe("LOW");
		expect(result.flags).toHaveLength(0);
	});

	it("flags high failure rate", () => {
		const metrics = baseMetrics({
			totalCount: 100,
			successCount: 60, // 40% failure rate
		});
		const result = computeAnomalyReport(metrics);

		expect(result.flags.some((f) => f.type === "FAILURE_RATE")).toBe(true);
		expect(result.riskScore).toBeGreaterThan(0);
	});

	it("flags interaction with flagged contracts", () => {
		const metrics = baseMetrics({
			interactedWithFlagged: true,
		});
		const result = computeAnomalyReport(metrics);

		expect(result.flags.some((f) => f.type === "FLAGGED_CONTRACT")).toBe(true);
		expect(result.riskScore).toBeGreaterThan(0);
	});

	it("flags large value transfers", () => {
		const metrics = baseMetrics({
			totalCount: 100,
			totalVolume: BigInt(100e18), // avg = 1 ETH per tx
			latestTxValue: BigInt(10e18), // 10 ETH = 10x average (well above 50% threshold)
		});
		const result = computeAnomalyReport(metrics);

		expect(result.flags.some((f) => f.type === "LARGE_VALUE")).toBe(true);
	});

	it("returns maximum risk when all anomalies fire", () => {
		const metrics = baseMetrics({
			totalCount: 100,
			successCount: 50, // 50% failure
			totalVolume: BigInt(100e18),
			latestTxValue: BigInt(100e18), // 100x average
			interactedWithFlagged: true,
		});
		const result = computeAnomalyReport(metrics);

		expect(result.riskScore).toBeGreaterThanOrEqual(50);
		expect(result.flags.length).toBeGreaterThanOrEqual(2);
	});

	it("handles zero-activity agent gracefully", () => {
		const metrics = baseMetrics({
			totalCount: 0,
			successCount: 0,
			totalVolume: 0n,
			latestTxValue: 0n,
			firstActivityTimestamp: 0,
		});
		const result = computeAnomalyReport(metrics);

		expect(result.riskScore).toBeLessThanOrEqual(25);
		expect(result.severity).toBe("LOW");
	});

	it("handles brand new agent with first transaction", () => {
		const now = Math.floor(Date.now() / 1000);
		const metrics = baseMetrics({
			totalCount: 1,
			successCount: 1,
			totalVolume: BigInt(1e18),
			latestTxValue: BigInt(1e18),
			firstActivityTimestamp: now - 60, // 1 minute ago
		});
		const result = computeAnomalyReport(metrics);

		expect(result.severity).toBe("LOW");
	});
});

describe("classifyRiskSeverity", () => {
	it("classifies LOW for scores under 25", () => {
		expect(classifyRiskSeverity(0)).toBe("LOW");
		expect(classifyRiskSeverity(10)).toBe("LOW");
		expect(classifyRiskSeverity(24)).toBe("LOW");
	});

	it("classifies MEDIUM for scores 25-49", () => {
		expect(classifyRiskSeverity(25)).toBe("MEDIUM");
		expect(classifyRiskSeverity(40)).toBe("MEDIUM");
		expect(classifyRiskSeverity(49)).toBe("MEDIUM");
	});

	it("classifies HIGH for scores 50-74", () => {
		expect(classifyRiskSeverity(50)).toBe("HIGH");
		expect(classifyRiskSeverity(60)).toBe("HIGH");
		expect(classifyRiskSeverity(74)).toBe("HIGH");
	});

	it("classifies CRITICAL for scores 75+", () => {
		expect(classifyRiskSeverity(75)).toBe("CRITICAL");
		expect(classifyRiskSeverity(90)).toBe("CRITICAL");
		expect(classifyRiskSeverity(100)).toBe("CRITICAL");
	});
});

describe("Helper computations", () => {
	it("computeAccountAgeDays returns correct days", () => {
		const now = Math.floor(Date.now() / 1000);
		const metrics = baseMetrics({
			firstActivityTimestamp: now - 90 * 86400,
			currentTimestamp: now,
		});
		const days = computeAccountAgeDays(metrics);
		expect(Math.floor(days)).toBe(90);
	});

	it("computeAccountAgeDays returns 0 for no activity", () => {
		const metrics = baseMetrics({ firstActivityTimestamp: 0 });
		expect(computeAccountAgeDays(metrics)).toBe(0);
	});

	it("computeBaselineFrequency returns correct rate", () => {
		const now = Math.floor(Date.now() / 1000);
		const metrics = baseMetrics({
			totalCount: 90,
			firstActivityTimestamp: now - 90 * 86400,
			currentTimestamp: now,
		});
		const freq = computeBaselineFrequency(metrics);
		expect(Math.round(freq)).toBe(1); // ~1 tx/day
	});

	it("computeAverageTxValue returns correct average", () => {
		const metrics = baseMetrics({
			totalCount: 10,
			totalVolume: BigInt(100e18),
		});
		const avg = computeAverageTxValue(metrics);
		expect(avg).toBe(10); // 10 ETH per tx
	});

	it("computeAverageTxValue returns 0 for no transactions", () => {
		const metrics = baseMetrics({ totalCount: 0, totalVolume: 0n });
		expect(computeAverageTxValue(metrics)).toBe(0);
	});

	it("computeFailureRate returns correct rate", () => {
		const metrics = baseMetrics({ totalCount: 100, successCount: 80 });
		expect(computeFailureRate(metrics)).toBe(0.2);
	});

	it("computeFailureRate returns 0 for no transactions", () => {
		const metrics = baseMetrics({ totalCount: 0, successCount: 0 });
		expect(computeFailureRate(metrics)).toBe(0);
	});

	it("computeFailureRate returns 0 for 100% success", () => {
		const metrics = baseMetrics({ totalCount: 100, successCount: 100 });
		expect(computeFailureRate(metrics)).toBe(0);
	});
});
