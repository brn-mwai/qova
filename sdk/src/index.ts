/**
 * @qova/core - Financial Trust Infrastructure for AI Agents
 *
 * TypeScript SDK for interacting with the Qova protocol on Base L2.
 *
 * Two ways to use:
 *   1. HTTP SDK (recommended) — API key auth, no wallet needed:
 *      import Qova from "@qova/core";
 *      const qova = new Qova("qova_your_api_key");
 *
 *   2. On-chain SDK (advanced) — direct contract interaction:
 *      import { createQovaClient } from "@qova/core/chain";
 *
 * @author Qova Engineering <eng@qova.cc>
 * @see https://qova.cc
 */

// ── HTTP SDK (primary interface) ──
export { Qova, type QovaOptions } from "./http/client.js";
export { Agents } from "./http/agents.js";
export { Scores } from "./http/scores.js";
export { Transactions } from "./http/transactions.js";
export { Budgets } from "./http/budgets.js";
export { Verify } from "./http/verify.js";
export { Keys } from "./http/keys.js";
export {
	QovaApiError,
	QovaAuthError,
	QovaRateLimitError,
	QovaNetworkError,
	QovaConfigError,
} from "./http/errors.js";
export type * from "./http/types.js";

// Default export for `import Qova from "@qova/core"`
export { Qova as default } from "./http/client.js";

// ── ABIs (for advanced usage) ──
export {
	budgetEnforcerAbi,
	qovaCoreAbi,
	reputationRegistryAbi,
	transactionValidatorAbi,
} from "./abi/index.js";
export type { QovaClient } from "./client.js";

// ── Client ──
export { createQovaClient } from "./client.js";
// ── Constants ──
export {
	BLOCK_EXPLORERS,
	CHAIN_IDS,
	CONTRACTS,
	DEFAULT_CHAIN_ID,
	DEFAULT_RPC_URLS,
	getContracts,
	MAX_SCORE,
	MIN_SCORE,
	SCORE_GRADE_THRESHOLDS,
} from "./constants.js";
export {
	checkBudget,
	getBudgetStatus,
	recordSpend,
	setBudget,
} from "./contracts/budget.js";
export { executeAgentAction } from "./contracts/core.js";
// ── Contract Wrappers ──
export {
	batchUpdateScores,
	getAgentDetails,
	getScore,
	isAgentRegistered,
	registerAgent,
	updateScore,
} from "./contracts/reputation.js";
export {
	getTransactionStats,
	recordTransaction,
} from "./contracts/transactions.js";
// ── Events ──
export {
	watchAgentActions,
	watchScoreUpdates,
	watchTransactions,
} from "./events.js";
// ── Types ──
export type {
	AgentDetails,
	AgentScore,
	ScoreGrade,
} from "./types/agent.js";
export { AgentDetailsSchema, AgentScoreSchema, SCORE_GRADES } from "./types/agent.js";
export type { BudgetConfig, BudgetStatus } from "./types/budget.js";
export { BudgetConfigSchema, BudgetStatusSchema } from "./types/budget.js";
export type { Chain, ContractAddresses, QovaClientConfig } from "./types/config.js";
export { ChainSchema, ContractAddressesSchema, QovaClientConfigSchema } from "./types/config.js";
export {
	AgentAlreadyRegisteredError,
	AgentNotRegisteredError,
	BudgetExceededError,
	InvalidScoreError,
	QovaError,
	UnauthorizedError,
} from "./types/errors.js";

export type {
	AgentActionExecutedEvent,
	QovaEvent,
	ScoreUpdatedEvent,
	TransactionRecordedEvent,
	WatchConfig,
} from "./types/events.js";
export type { TransactionStats } from "./types/transaction.js";
export {
	TRANSACTION_TYPE_LABELS,
	TransactionStatsSchema,
	TransactionType,
} from "./types/transaction.js";
export type { AgentIdentity, ReputationScore, TransactionRecord } from "./types.js";
// ── Result Pattern (legacy, kept for backward compatibility) ──
export { err, ok, type Result } from "./types.js";
export {
	checksumAddress,
	isValidAddress,
	shortenAddress,
} from "./utils/address.js";
export {
	formatBasisPoints,
	formatTimestamp,
	formatWei,
} from "./utils/format.js";
// ── Utilities ──
export {
	formatScore,
	getGrade,
	getScoreColor,
	scoreToPercentage,
} from "./utils/score.js";
