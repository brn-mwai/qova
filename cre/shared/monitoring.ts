/**
 * @file shared/monitoring.ts
 * Pure computation functions for transaction monitoring anomaly detection.
 * All functions are deterministic -- safe for BFT consensus across DON nodes.
 */

import {
	FAILURE_RATE_THRESHOLD,
	FREQUENCY_STD_DEV_THRESHOLD,
	LARGE_VALUE_RATIO_THRESHOLD,
	RISK_SCORE_MAX,
	RISK_SCORE_MIN,
	RISK_SEVERITY,
	RISK_WEIGHTS,
} from "./constants";
import type { AnomalyFlag, RiskSeverity } from "./types";

/** Input metrics for anomaly computation */
export interface MonitoringMetrics {
	/** Total number of transactions for this agent */
	totalCount: number;
	/** Number of successful transactions */
	successCount: number;
	/** Total transaction volume in wei (as string for precision) */
	totalVolume: bigint;
	/** Value of the latest transaction in wei */
	latestTxValue: bigint;
	/** Timestamp of the latest transaction (unix seconds) */
	latestTxTimestamp: number;
	/** Timestamp of the agent's first recorded activity (unix seconds) */
	firstActivityTimestamp: number;
	/** Whether the interacted contract is on the flagged/unverified list */
	interactedWithFlagged: boolean;
	/** Current timestamp (unix seconds) */
	currentTimestamp: number;
}

/**
 * Compute anomaly flags and composite risk score from monitoring metrics.
 * @param metrics Raw metrics from on-chain + off-chain sources.
 * @returns Object with risk score, severity, and individual flags.
 */
export function computeAnomalyReport(metrics: MonitoringMetrics): {
	riskScore: number;
	severity: RiskSeverity;
	flags: AnomalyFlag[];
} {
	const flags: AnomalyFlag[] = [];

	// ── Frequency anomaly ──
	const frequencyScore = computeFrequencyAnomaly(metrics);
	if (frequencyScore > 0) {
		flags.push({
			type: "FREQUENCY",
			description: `Transaction frequency exceeds ${FREQUENCY_STD_DEV_THRESHOLD} standard deviations from baseline`,
			severity: frequencyScore,
			value: computeTransactionsPerDay(metrics),
			threshold: computeBaselineFrequency(metrics) * (1 + FREQUENCY_STD_DEV_THRESHOLD),
		});
	}

	// ── Large value anomaly ──
	const largeValueScore = computeLargeValueAnomaly(metrics);
	if (largeValueScore > 0) {
		flags.push({
			type: "LARGE_VALUE",
			description: `Single transaction value exceeds ${LARGE_VALUE_RATIO_THRESHOLD * 100}% of historical average`,
			severity: largeValueScore,
			value: Number(metrics.latestTxValue) / 1e18,
			threshold: computeAverageTxValue(metrics) * (1 + LARGE_VALUE_RATIO_THRESHOLD),
		});
	}

	// ── Failure rate anomaly ──
	const failureRateScore = computeFailureRateAnomaly(metrics);
	if (failureRateScore > 0) {
		const failureRate = computeFailureRate(metrics);
		flags.push({
			type: "FAILURE_RATE",
			description: `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds ${FAILURE_RATE_THRESHOLD * 100}% threshold`,
			severity: failureRateScore,
			value: failureRate,
			threshold: FAILURE_RATE_THRESHOLD,
		});
	}

	// ── Flagged contract interaction ──
	const flaggedScore = metrics.interactedWithFlagged ? 1.0 : 0;
	if (flaggedScore > 0) {
		flags.push({
			type: "FLAGGED_CONTRACT",
			description: "Transaction involves an unverified or flagged contract address",
			severity: flaggedScore,
			value: 1,
			threshold: 0,
		});
	}

	// ── Composite risk score ──
	const weightedScore =
		frequencyScore * RISK_WEIGHTS.frequencyAnomaly +
		largeValueScore * RISK_WEIGHTS.largeValueAnomaly +
		failureRateScore * RISK_WEIGHTS.failureRateAnomaly +
		flaggedScore * RISK_WEIGHTS.flaggedContractAnomaly;

	const riskScore = Math.round(
		Math.max(RISK_SCORE_MIN, Math.min(RISK_SCORE_MAX, weightedScore * RISK_SCORE_MAX)),
	);

	const severity = classifyRiskSeverity(riskScore);

	return { riskScore, severity, flags };
}

/**
 * Compute frequency anomaly score.
 * Compares current transaction rate to the agent's historical baseline.
 * @returns Anomaly score between 0.0 (normal) and 1.0 (highly anomalous).
 */
function computeFrequencyAnomaly(metrics: MonitoringMetrics): number {
	const accountAgeDays = computeAccountAgeDays(metrics);
	if (accountAgeDays < 1) return 0;

	const baseline = computeBaselineFrequency(metrics);
	if (baseline <= 0) return 0;

	const currentRate = computeTransactionsPerDay(metrics);
	const deviation = (currentRate - baseline) / Math.max(baseline, 1);

	if (deviation <= FREQUENCY_STD_DEV_THRESHOLD) return 0;

	return Math.min(1, (deviation - FREQUENCY_STD_DEV_THRESHOLD) / FREQUENCY_STD_DEV_THRESHOLD);
}

/**
 * Compute large value transfer anomaly score.
 * Flags single transactions that are significantly larger than the agent's average.
 * @returns Anomaly score between 0.0 (normal) and 1.0 (highly anomalous).
 */
function computeLargeValueAnomaly(metrics: MonitoringMetrics): number {
	const avgValue = computeAverageTxValue(metrics);
	if (avgValue <= 0) return 0;

	const latestValue = Number(metrics.latestTxValue) / 1e18;
	const ratio = latestValue / avgValue;

	if (ratio <= 1 + LARGE_VALUE_RATIO_THRESHOLD) return 0;

	return Math.min(1, (ratio - 1 - LARGE_VALUE_RATIO_THRESHOLD) / 2);
}

/**
 * Compute failure rate anomaly score.
 * Flags agents with high transaction failure rates.
 * @returns Anomaly score between 0.0 (normal) and 1.0 (highly anomalous).
 */
function computeFailureRateAnomaly(metrics: MonitoringMetrics): number {
	const failureRate = computeFailureRate(metrics);

	if (failureRate <= FAILURE_RATE_THRESHOLD) return 0;

	return Math.min(1, (failureRate - FAILURE_RATE_THRESHOLD) / (1 - FAILURE_RATE_THRESHOLD));
}

/**
 * Classify a numeric risk score into a severity category.
 * @param riskScore Risk score (0-100).
 * @returns The severity classification.
 */
export function classifyRiskSeverity(riskScore: number): RiskSeverity {
	if (riskScore >= RISK_SEVERITY.HIGH) return "CRITICAL";
	if (riskScore >= RISK_SEVERITY.MEDIUM) return "HIGH";
	if (riskScore >= RISK_SEVERITY.LOW) return "MEDIUM";
	return "LOW";
}

// ──────────────────────────────────────────────
//  Helper Computations (exported for testing)
// ──────────────────────────────────────────────

/** Compute the account age in days from metrics timestamps. */
export function computeAccountAgeDays(metrics: MonitoringMetrics): number {
	if (metrics.firstActivityTimestamp <= 0) return 0;
	const elapsed = metrics.currentTimestamp - metrics.firstActivityTimestamp;
	return Math.max(0, elapsed / 86400);
}

/** Compute baseline transaction frequency (transactions per day). */
export function computeBaselineFrequency(metrics: MonitoringMetrics): number {
	const days = computeAccountAgeDays(metrics);
	if (days < 1) return metrics.totalCount;
	return metrics.totalCount / days;
}

/** Compute current transactions per day (using a 1-day window). */
export function computeTransactionsPerDay(metrics: MonitoringMetrics): number {
	if (metrics.totalCount <= 0) return 0;
	const days = computeAccountAgeDays(metrics);
	if (days < 1) return metrics.totalCount;
	return metrics.totalCount / days;
}

/** Compute average transaction value in ETH. */
export function computeAverageTxValue(metrics: MonitoringMetrics): number {
	if (metrics.totalCount <= 0) return 0;
	return Number(metrics.totalVolume) / 1e18 / metrics.totalCount;
}

/** Compute failure rate (0.0 to 1.0). */
export function computeFailureRate(metrics: MonitoringMetrics): number {
	if (metrics.totalCount <= 0) return 0;
	const failedCount = metrics.totalCount - metrics.successCount;
	return failedCount / metrics.totalCount;
}
