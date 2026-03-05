/**
 * @file shared/constants.ts
 * CRE workflow constants: chain selectors, contract addresses, scoring weights,
 * monitoring thresholds, budget alert levels, and verification parameters.
 */

import type { Address } from "viem";

// ──────────────────────────────────────────────
//  Chain Configuration
// ──────────────────────────────────────────────

/** CRE chain selector for Base Sepolia testnet */
export const BASE_SEPOLIA_CHAIN_SELECTOR = 10344971235874465080n;
export const BASE_SEPOLIA_SELECTOR_NAME = "ethereum-testnet-sepolia-base-1";

/** Base Sepolia RPC endpoint for direct HTTP fetches */
export const BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";

// ──────────────────────────────────────────────
//  Contract Addresses (Base Sepolia)
// ──────────────────────────────────────────────

/** Deployed Qova contract addresses on Base Sepolia */
export const CONTRACTS = {
	ReputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB" as Address,
	TransactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900" as Address,
	BudgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E" as Address,
	QovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a" as Address,
} as const;

// ──────────────────────────────────────────────
//  Reputation Scoring
// ──────────────────────────────────────────────

/** Scoring algorithm weights -- must sum to 1.0 */
export const SCORE_WEIGHTS = {
	transactionVolume: 0.25,
	transactionCount: 0.2,
	successRate: 0.3,
	budgetCompliance: 0.15,
	accountAge: 0.1,
} as const;

/** Only write on-chain if score changes by >= this many points */
export const MIN_SCORE_CHANGE = 10;

/** Alert if score drops below this threshold */
export const CRITICAL_SCORE_THRESHOLD = 300;

/** Score bounds */
export const MIN_SCORE = 0;
export const MAX_SCORE = 1000;

// ──────────────────────────────────────────────
//  Transaction Monitor Thresholds
// ──────────────────────────────────────────────

/** Standard deviations above mean frequency to flag as anomalous */
export const FREQUENCY_STD_DEV_THRESHOLD = 2;

/** Percentage of historical average value to flag a single large transfer (0.5 = 50%) */
export const LARGE_VALUE_RATIO_THRESHOLD = 0.5;

/** Failure rate threshold for flagging (0.2 = 20%) */
export const FAILURE_RATE_THRESHOLD = 0.2;

/** Lookback window for failure rate calculation (24 hours in seconds) */
export const FAILURE_RATE_WINDOW_SECONDS = 86400;

/** Risk score bounds for transaction monitoring (0 = safe, 100 = high risk) */
export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

/** Weights for each anomaly factor in the composite risk score */
export const RISK_WEIGHTS = {
	frequencyAnomaly: 0.3,
	largeValueAnomaly: 0.25,
	failureRateAnomaly: 0.25,
	flaggedContractAnomaly: 0.2,
} as const;

/** Risk severity thresholds */
export const RISK_SEVERITY = {
	LOW: 25,
	MEDIUM: 50,
	HIGH: 75,
} as const;

// ──────────────────────────────────────────────
//  Budget Alert Thresholds
// ──────────────────────────────────────────────

/** Budget utilization thresholds (percentage) */
export const BUDGET_THRESHOLDS = {
	GREEN_MAX: 70,
	YELLOW_MAX: 90,
	RED_MAX: 100,
} as const;

// ──────────────────────────────────────────────
//  Agent Verification Parameters
// ──────────────────────────────────────────────

/** Minimum age of contract creation to not flag as suspicious (seconds) */
export const MIN_CONTRACT_AGE_SECONDS = 86400; // 1 day

/** Maximum inactivity period before flagging (30 days in seconds) */
export const MAX_INACTIVITY_SECONDS = 30 * 86400;

/** Minimum number of transactions to consider an agent "active" */
export const MIN_ACTIVITY_TX_COUNT = 1;

/** Suspicious ownership transfer window (7 days in seconds) */
export const SUSPICIOUS_TRANSFER_WINDOW_SECONDS = 7 * 86400;

/** Minimum reputation score for full verification */
export const VERIFICATION_MIN_SCORE = 100;

/** CRE workflow reason hashes */
export const CRE_REASONS = {
	reputationOracle: "cre-reputation-oracle",
	transactionMonitor: "cre-transaction-monitor",
	budgetAlert: "cre-budget-alert",
	agentVerify: "cre-agent-verify",
} as const;
