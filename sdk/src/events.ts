/**
 * Event watchers for Qova contract events using viem's watchContractEvent.
 * @author Qova Engineering <eng@qova.cc>
 */

import { type Address, createPublicClient, http, type PublicClient } from "viem";
import { base, baseSepolia, type Chain as ViemChain } from "viem/chains";
import { qovaCoreAbi, reputationRegistryAbi, transactionValidatorAbi } from "./abi/index.js";
import { CHAIN_IDS, CONTRACTS, DEFAULT_RPC_URLS } from "./constants.js";
import type {
	AgentActionExecutedEvent,
	ScoreUpdatedEvent,
	TransactionRecordedEvent,
	WatchConfig,
} from "./types/events.js";
import { QovaError } from "./types/errors.js";
import type { TransactionType } from "./types/transaction.js";
import { isAgentActionArgs, isScoreUpdateArgs, isTransactionArgs } from "./utils/guards.js";

/** SKALE Base L3 chain definition for viem. */
const skaleBase: ViemChain = {
	id: CHAIN_IDS.SKALE_BASE,
	name: "SKALE Base",
	nativeCurrency: { name: "CREDIT", symbol: "CREDIT", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://skale-base.skalenodes.com/v1/base"] },
	},
};

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

function resolveClient(config: WatchConfig): { publicClient: PublicClient; chainId: number } {
	const chainId = CHAIN_ID_FROM_NAME[config.chain];
	const chain = CHAIN_MAP[config.chain];
	if (chainId === undefined || !chain) {
		throw new QovaError(`No contracts deployed on chain ${config.chain}`, "UNSUPPORTED_CHAIN"); // FIX: §2.3
	}
	const rpcUrl = config.rpcUrl ?? DEFAULT_RPC_URLS[chainId];
	// Cast needed for L2 chain type compatibility (OP stack deposit tx types)
	const publicClient = createPublicClient({ chain, transport: http(rpcUrl) }) as PublicClient;
	return { publicClient, chainId };
}

/**
 * Watch for ScoreUpdated events from the ReputationRegistry.
 * @param config - Watch configuration (chain, optional rpcUrl/fromBlock/agent filter).
 * @param callback - Called when a ScoreUpdated event is detected.
 * @returns Unsubscribe function to stop watching.
 * @example
 * ```ts
 * const unwatch = watchScoreUpdates({ chain: "base-sepolia" }, (event) => {
 *   console.log(`${event.agent}: ${event.oldScore} -> ${event.newScore}`);
 * });
 * // Later: unwatch();
 * ```
 */
export function watchScoreUpdates(
	config: WatchConfig,
	callback: (event: ScoreUpdatedEvent) => void,
): () => void {
	const { publicClient, chainId } = resolveClient(config);
	const contracts = CONTRACTS[chainId];
	if (!contracts) throw new QovaError(`No contracts deployed on chain ${config.chain}`, "UNSUPPORTED_CHAIN"); // FIX: §2.3

	return publicClient.watchContractEvent({
		address: contracts.ReputationRegistry,
		abi: reputationRegistryAbi,
		eventName: "ScoreUpdated",
		onLogs: (logs) => {
			for (const log of logs) {
				try { // FIX: §2.2 error boundary
					if (!isScoreUpdateArgs(log.args)) continue; // FIX: §1.1 type guard
					if (config.agent && log.args.agent !== config.agent) continue;
					callback({
						agent: log.args.agent,
						oldScore: Number(log.args.oldScore),
						newScore: Number(log.args.newScore),
						reason: log.args.reason,
						timestamp: BigInt(log.args.timestamp),
					});
				} catch (err) {
					console.error("[Qova SDK] Event parsing error:", err);
				}
			}
		},
	});
}

/**
 * Watch for TransactionRecorded events from the TransactionValidator.
 * @param config - Watch configuration.
 * @param callback - Called when a TransactionRecorded event is detected.
 * @returns Unsubscribe function.
 */
export function watchTransactions(
	config: WatchConfig,
	callback: (event: TransactionRecordedEvent) => void,
): () => void {
	const { publicClient, chainId } = resolveClient(config);
	const contracts = CONTRACTS[chainId];
	if (!contracts) throw new QovaError(`No contracts deployed on chain ${config.chain}`, "UNSUPPORTED_CHAIN"); // FIX: §2.3

	return publicClient.watchContractEvent({
		address: contracts.TransactionValidator,
		abi: transactionValidatorAbi,
		eventName: "TransactionRecorded",
		onLogs: (logs) => {
			for (const log of logs) {
				try { // FIX: §2.2 error boundary
					if (!isTransactionArgs(log.args)) continue; // FIX: §1.1 type guard
					if (config.agent && log.args.agent !== config.agent) continue;
					callback({
						agent: log.args.agent,
						txHash: log.args.txHash,
						amount: BigInt(log.args.amount),
						txType: Number(log.args.txType) as TransactionType,
						timestamp: BigInt(log.args.timestamp),
					});
				} catch (err) {
					console.error("[Qova SDK] Event parsing error:", err);
				}
			}
		},
	});
}

/**
 * Watch for AgentActionExecuted events from QovaCore.
 * @param config - Watch configuration.
 * @param callback - Called when an AgentActionExecuted event is detected.
 * @returns Unsubscribe function.
 */
export function watchAgentActions(
	config: WatchConfig,
	callback: (event: AgentActionExecutedEvent) => void,
): () => void {
	const { publicClient, chainId } = resolveClient(config);
	const contracts = CONTRACTS[chainId];
	if (!contracts) throw new QovaError(`No contracts deployed on chain ${config.chain}`, "UNSUPPORTED_CHAIN"); // FIX: §2.3

	return publicClient.watchContractEvent({
		address: contracts.QovaCore,
		abi: qovaCoreAbi,
		eventName: "AgentActionExecuted",
		onLogs: (logs) => {
			for (const log of logs) {
				try { // FIX: §2.2 error boundary
					if (!isAgentActionArgs(log.args)) continue; // FIX: §1.1 type guard
					if (config.agent && log.args.agent !== config.agent) continue;
					callback({
						agent: log.args.agent,
						txHash: log.args.txHash,
						amount: BigInt(log.args.amount),
						txType: Number(log.args.txType) as TransactionType,
						timestamp: BigInt(log.args.timestamp),
					});
				} catch (err) {
					console.error("[Qova SDK] Event parsing error:", err);
				}
			}
		},
	});
}
