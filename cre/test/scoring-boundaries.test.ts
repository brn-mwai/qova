/**
 * Scoring boundary and granularity tests.
 * Covers Fix 2.3 (budget utilization boundaries) and Fix 2.4 (volume granularity).
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "bun:test";
import { type AgentMetrics, computeReputationScore } from "../shared/scoring";

const ETH = 1000000000000000000n; // 1 ETH in wei

/** Helper: create metrics focused on volume scoring */
function metricsWithVolume(volume: bigint): AgentMetrics {
	return {
		totalVolume: volume,
		transactionCount: 100,
		successRate: 10000, // 100% success
		dailySpent: 0n,
		dailyLimit: 0n,
		accountAgeSeconds: 365 * 86400,
		sanctionsClean: true,
	};
}

/** Helper: create metrics focused on budget compliance */
function metricsWithBudget(spent: bigint, limit: bigint): AgentMetrics {
	return {
		totalVolume: BigInt(10e18),
		transactionCount: 100,
		successRate: 10000,
		dailySpent: spent,
		dailyLimit: limit,
		accountAgeSeconds: 365 * 86400,
		sanctionsClean: true,
	};
}

describe("volume scoring granularity (Fix 2.4)", () => {
	it("scores 0 for zero volume", () => {
		const score = computeReputationScore(metricsWithVolume(0n));
		const scoreNoVol = computeReputationScore(metricsWithVolume(0n));
		expect(scoreNoVol).toBeLessThan(computeReputationScore(metricsWithVolume(1n)));
	});

	it("scores 100 for dust amounts", () => {
		const s1 = computeReputationScore(metricsWithVolume(1n));
		const s2 = computeReputationScore(metricsWithVolume(ETH / 1000n));
		// Both should get the same score (100 bucket for > 0n but < 0.01 ETH)
		expect(s1).toBe(s2);
	});

	it("scores 200 at 0.01 ETH boundary", () => {
		const below = computeReputationScore(metricsWithVolume(ETH / 100n - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH / 100n));
		expect(at).toBeGreaterThan(below);
	});

	it("scores 400 at 0.1 ETH boundary", () => {
		const below = computeReputationScore(metricsWithVolume(ETH / 10n - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH / 10n));
		expect(at).toBeGreaterThan(below);
	});

	it("scores 500 at 0.5 ETH boundary (new granularity step)", () => {
		const below = computeReputationScore(metricsWithVolume(ETH / 2n - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH / 2n));
		expect(at).toBeGreaterThan(below);
	});

	it("scores 600 at 1 ETH boundary", () => {
		const below = computeReputationScore(metricsWithVolume(ETH - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH));
		expect(at).toBeGreaterThan(below);
	});

	it("scores 750 at 10 ETH boundary", () => {
		const below = computeReputationScore(metricsWithVolume(ETH * 10n - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH * 10n));
		expect(at).toBeGreaterThan(below);
	});

	it("scores 900 at 100 ETH boundary", () => {
		const below = computeReputationScore(metricsWithVolume(ETH * 100n - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH * 100n));
		expect(at).toBeGreaterThan(below);
	});

	it("scores 1000 at 1000 ETH boundary", () => {
		const below = computeReputationScore(metricsWithVolume(ETH * 1000n - 1n));
		const at = computeReputationScore(metricsWithVolume(ETH * 1000n));
		expect(at).toBeGreaterThan(below);
	});

	it("volume steps are monotonically increasing", () => {
		const volumes = [0n, 1n, ETH / 100n, ETH / 10n, ETH / 2n, ETH, ETH * 10n, ETH * 100n, ETH * 1000n];
		const scores = volumes.map(v => computeReputationScore(metricsWithVolume(v)));
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
		}
	});
});

describe("budget compliance scoring boundaries (Fix 2.3)", () => {
	const LIMIT = BigInt(10e18);

	it("returns full budget score at 0% utilization", () => {
		const s0 = computeReputationScore(metricsWithBudget(0n, LIMIT));
		const s50 = computeReputationScore(metricsWithBudget(LIMIT / 2n, LIMIT));
		// 0% and 50% are both under 80% threshold, should get same budget component
		expect(s0).toBe(s50);
	});

	it("returns full budget score at 80% utilization", () => {
		const s80 = computeReputationScore(metricsWithBudget(LIMIT * 80n / 100n, LIMIT));
		const s50 = computeReputationScore(metricsWithBudget(LIMIT / 2n, LIMIT));
		expect(s80).toBe(s50);
	});

	it("starts decaying above 80% utilization", () => {
		const s80 = computeReputationScore(metricsWithBudget(LIMIT * 80n / 100n, LIMIT));
		const s85 = computeReputationScore(metricsWithBudget(LIMIT * 85n / 100n, LIMIT));
		expect(s85).toBeLessThan(s80);
	});

	it("returns 0 budget score at 100% utilization", () => {
		const s100 = computeReputationScore(metricsWithBudget(LIMIT, LIMIT));
		const s80 = computeReputationScore(metricsWithBudget(LIMIT * 80n / 100n, LIMIT));
		expect(s100).toBeLessThan(s80);
	});

	it("returns 0 budget score above 100% utilization (overspent)", () => {
		const s120 = computeReputationScore(metricsWithBudget(LIMIT * 120n / 100n, LIMIT));
		const s100 = computeReputationScore(metricsWithBudget(LIMIT, LIMIT));
		expect(s120).toBeLessThanOrEqual(s100);
	});

	it("no-budget agents get full compliance score", () => {
		const noBudget = computeReputationScore(metricsWithBudget(0n, 0n));
		const lowUtil = computeReputationScore(metricsWithBudget(BigInt(1e18), BigInt(10e18)));
		expect(noBudget).toBe(lowUtil);
	});
});
