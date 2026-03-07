import { describe, expect, it } from "bun:test";
import { type AgentMetrics, computeReputationScore } from "../shared/scoring";

describe("computeReputationScore", () => {
	it("returns low score for a brand new agent with no activity", () => {
		const metrics: AgentMetrics = {
			totalVolume: 0n,
			transactionCount: 0,
			successRate: 0,
			dailySpent: 0n,
			dailyLimit: 0n,
			accountAgeSeconds: 0,
			sanctionsClean: true,
		};
		// New agent gets 150 from budget compliance (no limits = fully compliant at 15% weight)
		expect(computeReputationScore(metrics)).toBe(150);
	});

	it("returns 0 for sanctioned agent regardless of metrics", () => {
		const metrics: AgentMetrics = {
			totalVolume: BigInt(100e18),
			transactionCount: 500,
			successRate: 9800,
			dailySpent: BigInt(1e18),
			dailyLimit: BigInt(10e18),
			accountAgeSeconds: 365 * 86400,
			sanctionsClean: false,
		};
		expect(computeReputationScore(metrics)).toBe(0);
	});

	it("returns high score for active, compliant agent", () => {
		const metrics: AgentMetrics = {
			totalVolume: BigInt(100e18),
			transactionCount: 500,
			successRate: 9800,
			dailySpent: BigInt(1e18),
			dailyLimit: BigInt(10e18),
			accountAgeSeconds: 365 * 86400,
			sanctionsClean: true,
			apiReputationScore: 90,
		};
		const score = computeReputationScore(metrics);
		expect(score).toBeGreaterThan(700);
		expect(score).toBeLessThanOrEqual(1000);
	});

	it("penalizes agents over budget", () => {
		const compliantMetrics: AgentMetrics = {
			totalVolume: BigInt(10e18),
			transactionCount: 100,
			successRate: 9500,
			dailySpent: BigInt(1e18),
			dailyLimit: BigInt(10e18),
			accountAgeSeconds: 180 * 86400,
			sanctionsClean: true,
		};
		const overBudgetMetrics: AgentMetrics = {
			...compliantMetrics,
			dailySpent: BigInt(15e18),
			dailyLimit: BigInt(10e18),
		};
		expect(computeReputationScore(compliantMetrics)).toBeGreaterThan(
			computeReputationScore(overBudgetMetrics),
		);
	});

	it("weights success rate highest", () => {
		const highSuccess: AgentMetrics = {
			totalVolume: BigInt(1e18),
			transactionCount: 10,
			successRate: 10000,
			dailySpent: 0n,
			dailyLimit: 0n,
			accountAgeSeconds: 30 * 86400,
			sanctionsClean: true,
		};
		const lowSuccess: AgentMetrics = {
			...highSuccess,
			successRate: 5000,
		};
		const diff = computeReputationScore(highSuccess) - computeReputationScore(lowSuccess);
		expect(diff).toBeGreaterThan(100);
	});

	it("clamps score between 0 and 1000", () => {
		const maxMetrics: AgentMetrics = {
			totalVolume: BigInt(1000e18),
			transactionCount: 10000,
			successRate: 10000,
			dailySpent: 0n,
			dailyLimit: BigInt(1000e18),
			accountAgeSeconds: 10 * 365 * 86400,
			sanctionsClean: true,
			apiReputationScore: 100,
		};
		expect(computeReputationScore(maxMetrics)).toBeLessThanOrEqual(1000);
		expect(computeReputationScore(maxMetrics)).toBeGreaterThanOrEqual(0);
	});

	it("handles no-budget agents as fully compliant", () => {
		const noBudget: AgentMetrics = {
			totalVolume: BigInt(10e18),
			transactionCount: 100,
			successRate: 9500,
			dailySpent: 0n,
			dailyLimit: 0n,
			accountAgeSeconds: 90 * 86400,
			sanctionsClean: true,
		};
		const score = computeReputationScore(noBudget);
		expect(score).toBeGreaterThan(0);
	});
});
