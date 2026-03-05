/**
 * @file shared/budget.ts
 * Pure computation functions for budget alert level determination.
 * All functions are deterministic -- safe for BFT consensus across DON nodes.
 */

import { BUDGET_THRESHOLDS } from "./constants";
import type { BudgetAlertLevel } from "./types";

/** Input metrics for budget computation */
export interface BudgetMetrics {
	/** Amount spent in the current daily period (wei) */
	dailySpent: bigint;
	/** Remaining daily budget (wei) */
	dailyRemaining: bigint;
	/** Amount spent in the current monthly period (wei) */
	monthlySpent: bigint;
	/** Remaining monthly budget (wei) */
	monthlyRemaining: bigint;
	/** Per-transaction spending limit (wei) */
	perTxLimit: bigint;
}

/** Result of budget utilization computation */
export interface BudgetComputationResult {
	/** Daily utilization percentage (0-100+, can exceed 100 if overspent) */
	dailyUtilization: number;
	/** Monthly utilization percentage (0-100+) */
	monthlyUtilization: number;
	/** The higher of daily/monthly utilization, used for alert level */
	maxUtilization: number;
	/** Alert level based on max utilization */
	alertLevel: BudgetAlertLevel;
	/** Reconstructed daily limit (spent + remaining) */
	dailyLimit: bigint;
	/** Reconstructed monthly limit (spent + remaining) */
	monthlyLimit: bigint;
}

/**
 * Compute budget utilization and alert level from raw budget metrics.
 * @param metrics Budget status data from the BudgetEnforcer contract.
 * @returns Utilization percentages and alert classification.
 */
export function computeBudgetUtilization(metrics: BudgetMetrics): BudgetComputationResult {
	const dailyLimit = metrics.dailySpent + metrics.dailyRemaining;
	const monthlyLimit = metrics.monthlySpent + metrics.monthlyRemaining;

	const dailyUtilization = computeUtilizationPercent(metrics.dailySpent, dailyLimit);
	const monthlyUtilization = computeUtilizationPercent(metrics.monthlySpent, monthlyLimit);

	const maxUtilization = Math.max(dailyUtilization, monthlyUtilization);
	const alertLevel = classifyAlertLevel(maxUtilization);

	return {
		dailyUtilization,
		monthlyUtilization,
		maxUtilization,
		alertLevel,
		dailyLimit,
		monthlyLimit,
	};
}

/**
 * Compute utilization as a percentage.
 * @param spent Amount spent in the period.
 * @param limit Total limit for the period.
 * @returns Utilization percentage (0 if limit is 0).
 */
export function computeUtilizationPercent(spent: bigint, limit: bigint): number {
	if (limit <= 0n) return 0;
	return Number((spent * 10000n) / limit) / 100;
}

/**
 * Classify utilization percentage into an alert level.
 * @param utilization Utilization percentage (0-100+).
 * @returns The alert level classification.
 */
export function classifyAlertLevel(utilization: number): BudgetAlertLevel {
	if (utilization > BUDGET_THRESHOLDS.RED_MAX) return "CRITICAL";
	if (utilization > BUDGET_THRESHOLDS.YELLOW_MAX) return "RED";
	if (utilization >= BUDGET_THRESHOLDS.GREEN_MAX) return "YELLOW";
	return "GREEN";
}

/**
 * Determine whether an alert should be triggered.
 * Alerts are triggered for YELLOW, RED, and CRITICAL levels.
 * @param alertLevel The computed alert level.
 * @returns True if an alert should be sent.
 */
export function shouldTriggerAlert(alertLevel: BudgetAlertLevel): boolean {
	return alertLevel !== "GREEN";
}
