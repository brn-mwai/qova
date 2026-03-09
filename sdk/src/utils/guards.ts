/**
 * Runtime type guards for contract event args.
 * FIX: CONCERNS.md §1.1 - Replace unsafe `as Record<string, unknown>` casts.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Address } from "viem";

/** Type guard for ScoreUpdated event args. */
export function isScoreUpdateArgs(args: unknown): args is {
	agent: Address;
	oldScore: bigint;
	newScore: bigint;
	reason: `0x${string}`;
	timestamp: bigint;
} {
	if (!args || typeof args !== "object") return false;
	const a = args as Record<string, unknown>;
	return (
		typeof a.agent === "string" &&
		a.agent.startsWith("0x") &&
		(typeof a.oldScore === "bigint" || typeof a.oldScore === "number") &&
		(typeof a.newScore === "bigint" || typeof a.newScore === "number") &&
		(typeof a.timestamp === "bigint" || typeof a.timestamp === "number")
	);
}

/** Type guard for TransactionRecorded event args. */
export function isTransactionArgs(args: unknown): args is {
	agent: Address;
	txHash: `0x${string}`;
	amount: bigint;
	txType: number;
	timestamp: bigint;
} {
	if (!args || typeof args !== "object") return false;
	const a = args as Record<string, unknown>;
	return (
		typeof a.agent === "string" &&
		a.agent.startsWith("0x") &&
		typeof a.txHash === "string" &&
		(typeof a.amount === "bigint" || typeof a.amount === "number")
	);
}

/** Type guard for AgentActionExecuted event args (same shape as TransactionRecorded). */
export const isAgentActionArgs = isTransactionArgs;

/** Type guard for BudgetSet/SpendRecorded event args. */
export function isBudgetArgs(args: unknown): args is {
	agent: Address;
	dailySpent: bigint;
	monthlySpent: bigint;
	dailyLimit: bigint;
	timestamp: bigint;
} {
	if (!args || typeof args !== "object") return false;
	const a = args as Record<string, unknown>;
	return typeof a.agent === "string" && a.agent.startsWith("0x");
}
