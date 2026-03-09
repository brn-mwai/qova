/**
 * Typed event definitions matching contract event signatures.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Address, Hex, Log } from "viem";
import type { TransactionType } from "./transaction.js";

/** Emitted when a new agent is registered in ReputationRegistry. */
export type AgentRegisteredEvent = {
	agent: Address;
	timestamp: bigint;
};

/** Emitted when an agent's score is updated in ReputationRegistry. */
export type ScoreUpdatedEvent = {
	agent: Address;
	oldScore: number;
	newScore: number;
	reason: Hex;
	timestamp: bigint;
};

/** Emitted when a transaction is recorded in TransactionValidator. */
export type TransactionRecordedEvent = {
	agent: Address;
	txHash: Hex;
	amount: bigint;
	txType: TransactionType;
	timestamp: bigint;
};

/** Emitted when spend is recorded against a budget in BudgetEnforcer. */
export type SpendRecordedEvent = {
	agent: Address;
	amount: bigint;
	dailyRemaining: bigint;
	monthlyRemaining: bigint;
};

/** Emitted when an agent action is executed through QovaCore. */
export type AgentActionExecutedEvent = {
	agent: Address;
	txHash: Hex;
	amount: bigint;
	txType: TransactionType;
	timestamp: bigint;
};

/** Emitted when a budget is set or updated in BudgetEnforcer. */
export type BudgetSetEvent = {
	agent: Address;
	dailyLimit: bigint;
	monthlyLimit: bigint;
	perTxLimit: bigint;
};

/** Union of all Qova contract events. */
export type QovaEvent =
	| { type: "AgentRegistered"; data: AgentRegisteredEvent; log: Log }
	| { type: "ScoreUpdated"; data: ScoreUpdatedEvent; log: Log }
	| { type: "TransactionRecorded"; data: TransactionRecordedEvent; log: Log }
	| { type: "SpendRecorded"; data: SpendRecordedEvent; log: Log }
	| { type: "AgentActionExecuted"; data: AgentActionExecutedEvent; log: Log }
	| { type: "BudgetSet"; data: BudgetSetEvent; log: Log };

/** Configuration for event watchers. */
export type WatchConfig = {
	chain: "base-sepolia" | "base" | "skale-base";
	rpcUrl?: string;
	fromBlock?: bigint;
	/** Optional filter: only events involving this agent address. */
	agent?: Address;
};
