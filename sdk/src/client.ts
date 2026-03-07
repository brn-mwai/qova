/**
 * Qova client factory -- creates a typed client for interacting with the Qova protocol.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Hash, Hex } from "viem";
import { type Address, createPublicClient, http, type PublicClient, type WalletClient } from "viem";
import { base, baseSepolia, type Chain as ViemChain } from "viem/chains";
import { CHAIN_IDS, CONTRACTS, DEFAULT_RPC_URLS } from "./constants.js";

/** SKALE Base L3 chain definition for viem. */
const skaleBase: ViemChain = {
	id: 1187947933,
	name: "SKALE Base",
	nativeCurrency: { name: "CREDIT", symbol: "CREDIT", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://skale-base.skalenodes.com/v1/base"] },
	},
	blockExplorers: {
		default: {
			name: "SKALE Base Explorer",
			url: "https://skale-base-explorer.skalenodes.com",
		},
	},
};
import { checkBudget, getBudgetStatus, recordSpend, setBudget } from "./contracts/budget.js";
import { executeAgentAction } from "./contracts/core.js";

import {
	batchUpdateScores,
	getAgentDetails,
	getScore,
	isAgentRegistered,
	registerAgent,
	updateScore,
} from "./contracts/reputation.js";

import { getTransactionStats, recordTransaction } from "./contracts/transactions.js";
import type { AgentDetails } from "./types/agent.js";
import type { BudgetStatus } from "./types/budget.js";
import type { ContractAddresses, QovaClientConfig } from "./types/config.js";
import { QovaClientConfigSchema } from "./types/config.js";
import { QovaError } from "./types/errors.js";
import type { TransactionStats, TransactionType } from "./types/transaction.js";

const CHAIN_MAP: Record<string, ViemChain> = {
	"base-sepolia": baseSepolia,
	base: base,
	"skale-base": skaleBase,
};

const CHAIN_ID_FROM_NAME: Record<string, number> = {
	"base-sepolia": CHAIN_IDS.BASE_SEPOLIA,
	base: CHAIN_IDS.BASE_MAINNET,
	"skale-base": CHAIN_IDS.SKALE_BASE,
};

/** The QovaClient returned by createQovaClient. */
export type QovaClient = {
	/** The underlying viem PublicClient for read operations. */
	publicClient: PublicClient;
	/** The underlying viem WalletClient for write operations (may be undefined). */
	walletClient: WalletClient | undefined;
	/** Resolved contract addresses. */
	contracts: ContractAddresses;

	// -- Reputation --
	/** Get the reputation score for an agent (0-1000). */
	getScore: (agent: Address) => Promise<number>;
	/** Get full agent details struct. */
	getAgentDetails: (agent: Address) => Promise<AgentDetails>;
	/** Check if an agent is registered. */
	isAgentRegistered: (agent: Address) => Promise<boolean>;
	/** Register a new agent (write). */
	registerAgent: (agent: Address) => Promise<Hash>;
	/** Update an agent's score (write). */
	updateScore: (agent: Address, score: number, reason: Hex) => Promise<Hash>;
	/** Batch update scores for multiple agents (write). */
	batchUpdateScores: (agents: Address[], scores: number[], reasons: Hex[]) => Promise<Hash>;

	// -- Transactions --
	/** Record a transaction for an agent (write). */
	recordTransaction: (
		agent: Address,
		txHash: Hex,
		amount: bigint,
		txType: TransactionType,
	) => Promise<Hash>;
	/** Get aggregate transaction stats for an agent. */
	getTransactionStats: (agent: Address) => Promise<TransactionStats>;

	// -- Budget --
	/** Set budget limits for an agent (write). */
	setBudget: (agent: Address, daily: bigint, monthly: bigint, perTx: bigint) => Promise<Hash>;
	/** Check if a spend amount is within budget. */
	checkBudget: (agent: Address, amount: bigint) => Promise<boolean>;
	/** Record a spend against an agent's budget (write). */
	recordSpend: (agent: Address, amount: bigint) => Promise<Hash>;
	/** Get current budget status with remaining allowances. */
	getBudgetStatus: (agent: Address) => Promise<BudgetStatus>;

	// -- Core --
	/** Execute an agent action through QovaCore (write). */
	executeAgentAction: (
		agent: Address,
		txHash: Hex,
		amount: bigint,
		txType: TransactionType,
	) => Promise<Hash>;
};

/**
 * Create a QovaClient for interacting with the Qova protocol on-chain.
 * @param config - Client configuration (chain, optional rpcUrl, optional contract overrides).
 * @returns A fully-typed QovaClient with read and write methods.
 * @throws {QovaError} If the configuration is invalid.
 * @example
 * ```ts
 * const client = createQovaClient({ chain: "base-sepolia" });
 * const score = await client.getScore("0x...");
 * ```
 */
export function createQovaClient(config: QovaClientConfig): QovaClient {
	// Validate config with Zod (excluding walletClient which can't be validated)
	const parsed = QovaClientConfigSchema.safeParse(config);
	if (!parsed.success) {
		throw new QovaError(
			`Invalid client config: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
			"INVALID_CONFIG",
			parsed.error,
		);
	}

	const chainId = CHAIN_ID_FROM_NAME[config.chain];
	const chain = CHAIN_MAP[config.chain];

	if (chainId === undefined || !chain) {
		throw new QovaError(
			`Unknown chain: "${config.chain}"`,
			"INVALID_CONFIG",
		);
	}

	// Resolve contract addresses: user overrides > deployed defaults
	const defaultContracts = CONTRACTS[chainId];
	if (!defaultContracts && !config.contracts) {
		throw new QovaError(
			`No contracts deployed on chain "${config.chain}" and no overrides provided`,
			"NO_CONTRACTS",
		);
	}

	const contracts: ContractAddresses = {
		ReputationRegistry: (config.contracts?.ReputationRegistry ??
			defaultContracts?.ReputationRegistry) as Address,
		TransactionValidator: (config.contracts?.TransactionValidator ??
			defaultContracts?.TransactionValidator) as Address,
		BudgetEnforcer: (config.contracts?.BudgetEnforcer ??
			defaultContracts?.BudgetEnforcer) as Address,
		QovaCore: (config.contracts?.QovaCore ?? defaultContracts?.QovaCore) as Address,
	};

	const rpcUrl = config.rpcUrl ?? DEFAULT_RPC_URLS[chainId] ?? undefined;

	// Cast needed because baseSepolia (OP stack L2) includes deposit transaction
	// types that make the chain-specific PublicClient incompatible with the
	// generic PublicClient type used in contract wrapper function signatures.
	const publicClient = createPublicClient({
		chain,
		transport: http(rpcUrl),
	}) as PublicClient;

	const walletClient = config.walletClient;

	/** Ensure walletClient is present for write operations. */
	function requireWallet(): WalletClient {
		if (!walletClient) {
			throw new QovaError("walletClient is required for write operations", "NO_WALLET");
		}
		return walletClient;
	}

	return {
		publicClient,
		walletClient,
		contracts,

		// Reputation
		getScore: (agent) => getScore(publicClient, contracts.ReputationRegistry, agent),
		getAgentDetails: (agent) => getAgentDetails(publicClient, contracts.ReputationRegistry, agent),
		isAgentRegistered: (agent) =>
			isAgentRegistered(publicClient, contracts.ReputationRegistry, agent),
		registerAgent: (agent) =>
			registerAgent(requireWallet(), publicClient, contracts.ReputationRegistry, agent),
		updateScore: (agent, score, reason) =>
			updateScore(
				requireWallet(),
				publicClient,
				contracts.ReputationRegistry,
				agent,
				score,
				reason,
			),
		batchUpdateScores: (agents, scores, reasons) =>
			batchUpdateScores(
				requireWallet(),
				publicClient,
				contracts.ReputationRegistry,
				agents,
				scores,
				reasons,
			),

		// Transactions
		recordTransaction: (agent, txHash, amount, txType) =>
			recordTransaction(
				requireWallet(),
				publicClient,
				contracts.TransactionValidator,
				agent,
				txHash,
				amount,
				txType,
			),
		getTransactionStats: (agent) =>
			getTransactionStats(publicClient, contracts.TransactionValidator, agent),

		// Budget
		setBudget: (agent, daily, monthly, perTx) =>
			setBudget(
				requireWallet(),
				publicClient,
				contracts.BudgetEnforcer,
				agent,
				daily,
				monthly,
				perTx,
			),
		checkBudget: (agent, amount) =>
			checkBudget(publicClient, contracts.BudgetEnforcer, agent, amount),
		recordSpend: (agent, amount) =>
			recordSpend(requireWallet(), publicClient, contracts.BudgetEnforcer, agent, amount),
		getBudgetStatus: (agent) => getBudgetStatus(publicClient, contracts.BudgetEnforcer, agent),

		// Core
		executeAgentAction: (agent, txHash, amount, txType) =>
			executeAgentAction(
				requireWallet(),
				publicClient,
				contracts.QovaCore,
				agent,
				txHash,
				amount,
				txType,
			),
	};
}
