/**
 * @file shared/types.ts
 * Zod-validated configuration schemas and report types for CRE workflows.
 */

import { z } from "zod";

// ──────────────────────────────────────────────
//  Workflow Configuration Schemas
// ──────────────────────────────────────────────

/** Reputation Oracle config schema */
export const ReputationOracleConfigSchema = z.object({
	schedule: z.string(),
	evm: z.object({
		chainSelectorName: z.string(),
		reputationRegistry: z.string(),
		transactionValidator: z.string(),
		budgetEnforcer: z.string(),
	}),
	scoringApiUrl: z.string(),
});
export type ReputationOracleConfig = z.infer<typeof ReputationOracleConfigSchema>;

/** Transaction Monitor config schema */
export const TransactionMonitorConfigSchema = z.object({
	evm: z.object({
		chainSelectorName: z.string(),
		transactionValidator: z.string(),
		reputationRegistry: z.string(),
		qovaCore: z.string(),
	}),
	scoringApiUrl: z.string(),
	alertWebhookUrl: z.string().optional(),
	rpcUrl: z.string(),
});
export type TransactionMonitorConfig = z.infer<typeof TransactionMonitorConfigSchema>;

/** Budget Alert config schema */
export const BudgetAlertConfigSchema = z.object({
	evm: z.object({
		chainSelectorName: z.string(),
		budgetEnforcer: z.string(),
		reputationRegistry: z.string(),
		qovaCore: z.string(),
	}),
	alertWebhookUrl: z.string(),
	scoringApiUrl: z.string(),
});
export type BudgetAlertConfig = z.infer<typeof BudgetAlertConfigSchema>;

/** Agent Verify config schema */
export const AgentVerifyConfigSchema = z.object({
	evm: z.object({
		chainSelectorName: z.string(),
		reputationRegistry: z.string(),
		transactionValidator: z.string(),
		budgetEnforcer: z.string(),
		qovaCore: z.string(),
	}),
	sanctionsApiUrl: z.string(),
	rpcUrl: z.string(),
});
export type AgentVerifyConfig = z.infer<typeof AgentVerifyConfigSchema>;

// ──────────────────────────────────────────────
//  Scoring API Response Shapes
// ──────────────────────────────────────────────

/** Scoring API response shape */
export const ScoringResponseSchema = z.object({
	sanctionsClean: z.boolean(),
	apiReputationScore: z.number().min(0).max(100).optional(),
	riskLevel: z.string(),
	lastChecked: z.number(),
});
export type ScoringResponse = z.infer<typeof ScoringResponseSchema>;

// ──────────────────────────────────────────────
//  Report Types
// ──────────────────────────────────────────────

/** Alert severity levels for budget monitoring */
export type BudgetAlertLevel = "GREEN" | "YELLOW" | "RED" | "CRITICAL";

/** Verification status for agent-verify workflow */
export type VerificationStatus = "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "SUSPICIOUS";

/** Risk severity for transaction monitoring */
export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Individual anomaly flag from transaction monitoring */
export interface AnomalyFlag {
	/** Type of anomaly detected */
	type: "FREQUENCY" | "LARGE_VALUE" | "FAILURE_RATE" | "FLAGGED_CONTRACT";
	/** Human-readable description */
	description: string;
	/** Severity contribution (0.0 - 1.0) */
	severity: number;
	/** Raw metric that triggered the flag */
	value: number;
	/** Threshold that was exceeded */
	threshold: number;
}

/** Transaction monitoring report written on-chain */
export interface MonitoringReport {
	/** Agent address being monitored */
	agent: string;
	/** Composite risk score (0 = safe, 100 = high risk) */
	riskScore: number;
	/** Risk severity classification */
	severity: RiskSeverity;
	/** Individual anomaly flags */
	flags: AnomalyFlag[];
	/** Agent's current reputation score at time of check */
	currentReputationScore: number;
	/** Transaction statistics snapshot */
	txStats: {
		totalCount: number;
		successCount: number;
		totalVolume: string;
		failureRate: number;
	};
	/** Whether an alert was triggered */
	alertTriggered: boolean;
	/** Timestamp of the report (unix seconds) */
	timestamp: number;
}

/** Budget alert report written on-chain */
export interface BudgetReport {
	/** Agent address being monitored */
	agent: string;
	/** Alert level based on utilization */
	alertLevel: BudgetAlertLevel;
	/** Daily budget utilization (0-100+, can exceed 100 if overspent) */
	dailyUtilization: number;
	/** Monthly budget utilization (0-100+) */
	monthlyUtilization: number;
	/** Raw budget figures */
	budget: {
		dailySpent: string;
		dailyRemaining: string;
		dailyLimit: string;
		monthlySpent: string;
		monthlyRemaining: string;
		monthlyLimit: string;
		perTxLimit: string;
	};
	/** Agent's current reputation score at time of check */
	currentReputationScore: number;
	/** Whether an alert was triggered (Yellow or above) */
	alertTriggered: boolean;
	/** Timestamp of the report (unix seconds) */
	timestamp: number;
}

/** Individual verification check result */
export interface VerificationCheck {
	/** Name of the verification check */
	check: string;
	/** Whether the check passed */
	passed: boolean;
	/** Detail or reason */
	detail: string;
}

/** Agent verification report written on-chain */
export interface VerificationReport {
	/** Agent address being verified */
	agent: string;
	/** Overall verification status */
	status: VerificationStatus;
	/** Credit grade derived from score (AAA through D) */
	grade: string;
	/** Agent's reputation score at time of verification */
	score: number;
	/** Individual verification check results */
	checks: VerificationCheck[];
	/** Number of checks passed */
	checksPassed: number;
	/** Total number of checks performed */
	checksTotal: number;
	/** Whether agent is registered in ReputationRegistry */
	isRegistered: boolean;
	/** Whether agent has a budget configured */
	hasBudget: boolean;
	/** Whether sanctions screening passed */
	sanctionsClean: boolean;
	/** Transaction activity summary */
	activity: {
		totalTransactions: number;
		successRate: number;
		totalVolume: string;
		lastActivityTimestamp: number;
		isActive: boolean;
	};
	/** Timestamp of the report (unix seconds) */
	timestamp: number;
}
