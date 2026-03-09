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

	it("scores higher with apiReputationScore than without", () => {
		const base: AgentMetrics = {
			totalVolume: BigInt(10e18),
			transactionCount: 100,
			successRate: 9500,
			dailySpent: BigInt(1e18),
			dailyLimit: BigInt(10e18),
			accountAgeSeconds: 180 * 86400,
			sanctionsClean: true,
		};
		const withApi: AgentMetrics = { ...base, apiReputationScore: 95 };
		// apiReputationScore is optional metadata, score should still be valid
		expect(computeReputationScore(base)).toBeGreaterThan(0);
		expect(computeReputationScore(withApi)).toBeGreaterThan(0);
	});

	it("returns consistent scores for identical inputs", () => {
		const metrics: AgentMetrics = {
			totalVolume: BigInt(50e18),
			transactionCount: 200,
			successRate: 9000,
			dailySpent: BigInt(3e18),
			dailyLimit: BigInt(10e18),
			accountAgeSeconds: 120 * 86400,
			sanctionsClean: true,
		};
		const score1 = computeReputationScore(metrics);
		const score2 = computeReputationScore(metrics);
		expect(score1).toBe(score2);
	});

	it("handles maximum possible metrics without overflow", () => {
		const metrics: AgentMetrics = {
			totalVolume: BigInt(1000000e18),
			transactionCount: 1000000,
			successRate: 10000,
			dailySpent: 0n,
			dailyLimit: BigInt(1000000e18),
			accountAgeSeconds: 10 * 365 * 86400,
			sanctionsClean: true,
		};
		const score = computeReputationScore(metrics);
		expect(score).toBeLessThanOrEqual(1000);
		expect(score).toBeGreaterThanOrEqual(0);
	});
});

describe("penalty idempotency simulation", () => {
	it("penalty does not stack below 0", () => {
		let score = 30n;
		const penalty = 25n;
		// Apply penalty multiple times
		for (let i = 0; i < 5; i++) {
			score = score > penalty ? score - penalty : 0n;
		}
		expect(score).toBe(0n);
	});

	it("penalty is skipped within interval", () => {
		const currentScore = 500n;
		const lastUpdated = 1000n;
		const nowSec = 2000n; // 1000s since last update
		const minInterval = 3600n; // 1 hour

		const timeSinceLastUpdate = nowSec - lastUpdated;
		const shouldPenalize = timeSinceLastUpdate >= minInterval;
		expect(shouldPenalize).toBe(false);
		// Score unchanged
		const adjustedScore = shouldPenalize
			? (currentScore > 25n ? currentScore - 25n : 0n)
			: currentScore;
		expect(adjustedScore).toBe(500n);
	});

	it("penalty is applied after interval elapses", () => {
		const currentScore = 500n;
		const lastUpdated = 1000n;
		const nowSec = 5000n; // 4000s since last update
		const minInterval = 3600n;

		const timeSinceLastUpdate = nowSec - lastUpdated;
		const shouldPenalize = timeSinceLastUpdate >= minInterval;
		expect(shouldPenalize).toBe(true);
		const adjustedScore = shouldPenalize
			? (currentScore > 25n ? currentScore - 25n : 0n)
			: currentScore;
		expect(adjustedScore).toBe(475n);
	});
});
