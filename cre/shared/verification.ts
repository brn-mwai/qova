/**
 * @file shared/verification.ts
 * Pure computation functions for agent verification logic.
 * All functions are deterministic -- safe for BFT consensus across DON nodes.
 */

import {
	MAX_INACTIVITY_SECONDS,
	MIN_ACTIVITY_TX_COUNT,
	MIN_CONTRACT_AGE_SECONDS,
	SUSPICIOUS_TRANSFER_WINDOW_SECONDS,
	VERIFICATION_MIN_SCORE,
} from "./constants";
import type { VerificationCheck, VerificationStatus } from "./types";

/** Input data for agent verification */
export interface VerificationInput {
	/** Whether the agent is registered in ReputationRegistry */
	isRegistered: boolean;
	/** Agent's current reputation score (0-1000) */
	score: number;
	/** Registration timestamp from AgentDetails.lastUpdated */
	registrationTimestamp: number;
	/** Whether the agent contract exists on-chain (has bytecode) */
	contractExists: boolean;
	/** Timestamp the contract was created (from creation tx) */
	contractCreationTimestamp: number;
	/** Owner/admin address of the agent contract */
	ownerAddress: string;
	/** Whether the owner address is consistent with registration */
	ownerConsistent: boolean;
	/** Total number of transactions recorded for the agent */
	transactionCount: number;
	/** Timestamp of the agent's last recorded activity (unix seconds) */
	lastActivityTimestamp: number;
	/** Whether any governance/ownership transfers occurred recently */
	recentOwnershipTransfer: boolean;
	/** Timestamp of the most recent ownership transfer (0 if none) */
	lastOwnershipTransferTimestamp: number;
	/** Whether sanctions screening passed */
	sanctionsClean: boolean;
	/** Current timestamp (unix seconds) */
	currentTimestamp: number;
	/** Whether the agent has a budget configured */
	hasBudget: boolean;
}

/** Result of the verification computation */
export interface VerificationResult {
	/** Overall verification status */
	status: VerificationStatus;
	/** Individual check results */
	checks: VerificationCheck[];
	/** Number of checks passed */
	checksPassed: number;
	/** Total number of checks performed */
	checksTotal: number;
	/** Credit grade derived from score */
	grade: string;
}

/**
 * Run all verification checks and compute overall status.
 * @param input Verification input data from on-chain and off-chain sources.
 * @returns Verification result with status, checks, and grade.
 */
export function computeVerification(input: VerificationInput): VerificationResult {
	const checks: VerificationCheck[] = [];

	// Check 1: Agent is registered
	checks.push({
		check: "registration",
		passed: input.isRegistered,
		detail: input.isRegistered
			? "Agent is registered in ReputationRegistry"
			: "Agent is not registered",
	});

	// Check 2: Contract exists and is not self-destructed
	checks.push({
		check: "contract_exists",
		passed: input.contractExists,
		detail: input.contractExists
			? "Agent contract exists on-chain with valid bytecode"
			: "No contract bytecode found at agent address",
	});

	// Check 3: Contract age (not freshly deployed)
	const contractAge = input.currentTimestamp - input.contractCreationTimestamp;
	const contractAgeAdequate =
		input.contractCreationTimestamp > 0 && contractAge >= MIN_CONTRACT_AGE_SECONDS;
	checks.push({
		check: "contract_age",
		passed: contractAgeAdequate,
		detail: contractAgeAdequate
			? `Contract deployed ${Math.floor(contractAge / 86400)} days ago`
			: input.contractCreationTimestamp === 0
				? "Contract creation timestamp unavailable"
				: `Contract deployed only ${Math.floor(contractAge / 3600)} hours ago (minimum: ${MIN_CONTRACT_AGE_SECONDS / 86400} day)`,
	});

	// Check 4: Owner address consistency
	checks.push({
		check: "owner_consistent",
		passed: input.ownerConsistent,
		detail: input.ownerConsistent
			? "Owner address matches registration data"
			: "Owner address mismatch detected",
	});

	// Check 5: Recent activity (has transactions in last 30 days)
	const timeSinceLastActivity =
		input.lastActivityTimestamp > 0
			? input.currentTimestamp - input.lastActivityTimestamp
			: Number.MAX_SAFE_INTEGER;
	const isActive =
		input.transactionCount >= MIN_ACTIVITY_TX_COUNT &&
		timeSinceLastActivity <= MAX_INACTIVITY_SECONDS;
	checks.push({
		check: "recent_activity",
		passed: isActive,
		detail: isActive
			? `Agent has ${input.transactionCount} transactions, last active ${Math.floor(timeSinceLastActivity / 86400)} days ago`
			: input.transactionCount < MIN_ACTIVITY_TX_COUNT
				? `Agent has insufficient transactions (${input.transactionCount}/${MIN_ACTIVITY_TX_COUNT} required)`
				: `Agent inactive for ${Math.floor(timeSinceLastActivity / 86400)} days (maximum: ${MAX_INACTIVITY_SECONDS / 86400})`,
	});

	// Check 6: No suspicious ownership transfers
	const noSuspiciousTransfer =
		!input.recentOwnershipTransfer ||
		(input.lastOwnershipTransferTimestamp > 0 &&
			input.currentTimestamp - input.lastOwnershipTransferTimestamp >
				SUSPICIOUS_TRANSFER_WINDOW_SECONDS);
	checks.push({
		check: "ownership_stability",
		passed: noSuspiciousTransfer,
		detail: noSuspiciousTransfer
			? "No suspicious ownership transfers detected"
			: `Ownership transfer detected ${Math.floor((input.currentTimestamp - input.lastOwnershipTransferTimestamp) / 86400)} days ago (within ${SUSPICIOUS_TRANSFER_WINDOW_SECONDS / 86400}-day window)`,
	});

	// Check 7: Sanctions screening
	checks.push({
		check: "sanctions_screening",
		passed: input.sanctionsClean,
		detail: input.sanctionsClean
			? "Sanctions screening passed"
			: "Agent flagged in sanctions screening",
	});

	// Check 8: Minimum reputation score
	const hasMinScore = input.score >= VERIFICATION_MIN_SCORE;
	checks.push({
		check: "minimum_score",
		passed: hasMinScore,
		detail: hasMinScore
			? `Reputation score ${input.score} meets minimum threshold (${VERIFICATION_MIN_SCORE})`
			: `Reputation score ${input.score} below minimum threshold (${VERIFICATION_MIN_SCORE})`,
	});

	// Compute results
	const checksPassed = checks.filter((c) => c.passed).length;
	const checksTotal = checks.length;
	const status = classifyVerificationStatus(checks, input);
	const grade = computeCreditGrade(input.score);

	return { status, checks, checksPassed, checksTotal, grade };
}

/**
 * Classify the overall verification status from individual check results.
 * @param checks Array of individual check results.
 * @param input Original verification input for additional context.
 * @returns The verification status.
 */
export function classifyVerificationStatus(
	checks: VerificationCheck[],
	input: VerificationInput,
): VerificationStatus {
	const passedCount = checks.filter((c) => c.passed).length;
	const totalCount = checks.length;

	// Immediate disqualification: sanctions flagged
	if (!input.sanctionsClean) return "SUSPICIOUS";

	// Immediate disqualification: not registered
	if (!input.isRegistered) return "UNVERIFIED";

	// Suspicious: recent ownership transfer + other failures
	if (input.recentOwnershipTransfer && passedCount < totalCount - 1) return "SUSPICIOUS";

	// Full verification: all checks pass
	if (passedCount === totalCount) return "VERIFIED";

	// Partial verification: most checks pass (>= 75%)
	if (passedCount / totalCount >= 0.75) return "PARTIALLY_VERIFIED";

	// Suspicious: many failures
	if (passedCount / totalCount < 0.5) return "SUSPICIOUS";

	return "UNVERIFIED";
}

/**
 * Compute a credit grade from a reputation score.
 * @param score Reputation score (0-1000).
 * @returns Letter grade from AAA (highest) to D (lowest).
 */
export function computeCreditGrade(score: number): string {
	if (score >= 950) return "AAA";
	if (score >= 900) return "AA";
	if (score >= 850) return "A";
	if (score >= 750) return "BBB";
	if (score >= 650) return "BB";
	if (score >= 550) return "B";
	if (score >= 450) return "CCC";
	if (score >= 350) return "CC";
	if (score >= 250) return "C";
	return "D";
}
