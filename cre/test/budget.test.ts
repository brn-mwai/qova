import { describe, expect, it } from "bun:test";
import {
	type BudgetMetrics,
	classifyAlertLevel,
	computeBudgetUtilization,
	computeUtilizationPercent,
	shouldTriggerAlert,
} from "../shared/budget";

/** Helper: create base budget metrics with sensible defaults */
function baseBudget(overrides: Partial<BudgetMetrics> = {}): BudgetMetrics {
	return {
		dailySpent: BigInt(3e18),
		dailyRemaining: BigInt(7e18),
		monthlySpent: BigInt(50e18),
		monthlyRemaining: BigInt(250e18),
		perTxLimit: BigInt(5e18),
		...overrides,
	};
}

describe("computeBudgetUtilization", () => {
	it("computes GREEN for low utilization", () => {
		const metrics = baseBudget({
			dailySpent: BigInt(2e18),
			dailyRemaining: BigInt(8e18), // 20% daily
			monthlySpent: BigInt(30e18),
			monthlyRemaining: BigInt(270e18), // 10% monthly
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyUtilization).toBe(20);
		expect(result.monthlyUtilization).toBe(10);
		expect(result.alertLevel).toBe("GREEN");
	});

	it("computes YELLOW for 70-90% utilization", () => {
		const metrics = baseBudget({
			dailySpent: BigInt(8e18),
			dailyRemaining: BigInt(2e18), // 80% daily
			monthlySpent: BigInt(50e18),
			monthlyRemaining: BigInt(250e18), // ~17% monthly
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyUtilization).toBe(80);
		expect(result.alertLevel).toBe("YELLOW");
	});

	it("computes RED for 90-100% utilization", () => {
		const metrics = baseBudget({
			dailySpent: BigInt(95e17), // 9.5 ETH
			dailyRemaining: BigInt(5e16), // 0.05 ETH = 95% daily
			monthlySpent: BigInt(50e18),
			monthlyRemaining: BigInt(250e18),
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyUtilization).toBeGreaterThan(90);
		expect(result.alertLevel).toBe("RED");
	});

	it("computes CRITICAL for >100% utilization (overspent)", () => {
		const metrics = baseBudget({
			dailySpent: BigInt(12e18),
			dailyRemaining: 0n, // 100%+ (limit was 10 ETH, spent 12)
			monthlySpent: BigInt(50e18),
			monthlyRemaining: BigInt(250e18),
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyUtilization).toBe(100);
		expect(result.alertLevel).toBe("RED");
	});

	it("handles zero budget gracefully", () => {
		const metrics = baseBudget({
			dailySpent: 0n,
			dailyRemaining: 0n,
			monthlySpent: 0n,
			monthlyRemaining: 0n,
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyUtilization).toBe(0);
		expect(result.monthlyUtilization).toBe(0);
		expect(result.alertLevel).toBe("GREEN");
	});

	it("uses monthly utilization when daily is low but monthly is high", () => {
		const metrics = baseBudget({
			dailySpent: BigInt(1e18),
			dailyRemaining: BigInt(9e18), // 10% daily
			monthlySpent: BigInt(280e18),
			monthlyRemaining: BigInt(20e18), // ~93% monthly
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyUtilization).toBe(10);
		expect(result.monthlyUtilization).toBeGreaterThan(90);
		expect(result.maxUtilization).toBe(result.monthlyUtilization);
		expect(result.alertLevel).toBe("RED");
	});

	it("correctly reconstructs daily and monthly limits", () => {
		const metrics = baseBudget({
			dailySpent: BigInt(3e18),
			dailyRemaining: BigInt(7e18),
			monthlySpent: BigInt(50e18),
			monthlyRemaining: BigInt(250e18),
		});
		const result = computeBudgetUtilization(metrics);

		expect(result.dailyLimit).toBe(BigInt(10e18));
		expect(result.monthlyLimit).toBe(BigInt(300e18));
	});
});

describe("computeUtilizationPercent", () => {
	it("returns 0 for zero limit", () => {
		expect(computeUtilizationPercent(BigInt(5e18), 0n)).toBe(0);
	});

	it("returns 50 for half spent", () => {
		expect(computeUtilizationPercent(BigInt(5e18), BigInt(10e18))).toBe(50);
	});

	it("returns 100 for fully spent", () => {
		expect(computeUtilizationPercent(BigInt(10e18), BigInt(10e18))).toBe(100);
	});

	it("returns 0 for zero spent", () => {
		expect(computeUtilizationPercent(0n, BigInt(10e18))).toBe(0);
	});
});

describe("classifyAlertLevel", () => {
	it("returns GREEN below 70%", () => {
		expect(classifyAlertLevel(0)).toBe("GREEN");
		expect(classifyAlertLevel(50)).toBe("GREEN");
		expect(classifyAlertLevel(69.99)).toBe("GREEN");
	});

	it("returns YELLOW at 70-90%", () => {
		expect(classifyAlertLevel(70)).toBe("YELLOW");
		expect(classifyAlertLevel(80)).toBe("YELLOW");
		expect(classifyAlertLevel(90)).toBe("YELLOW");
	});

	it("returns RED at 90-100%", () => {
		expect(classifyAlertLevel(90.01)).toBe("RED");
		expect(classifyAlertLevel(95)).toBe("RED");
		expect(classifyAlertLevel(100)).toBe("RED");
	});

	it("returns CRITICAL above 100%", () => {
		expect(classifyAlertLevel(100.01)).toBe("CRITICAL");
		expect(classifyAlertLevel(120)).toBe("CRITICAL");
		expect(classifyAlertLevel(200)).toBe("CRITICAL");
	});
});

describe("shouldTriggerAlert", () => {
	it("returns false for GREEN", () => {
		expect(shouldTriggerAlert("GREEN")).toBe(false);
	});

	it("returns true for YELLOW", () => {
		expect(shouldTriggerAlert("YELLOW")).toBe(true);
	});

	it("returns true for RED", () => {
		expect(shouldTriggerAlert("RED")).toBe(true);
	});

	it("returns true for CRITICAL", () => {
		expect(shouldTriggerAlert("CRITICAL")).toBe(true);
	});
});
