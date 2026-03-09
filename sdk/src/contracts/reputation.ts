/**
 * Contract wrapper for ReputationRegistry.
 * @author Qova Engineering <eng@qova.cc>
 */

import { type Address, type Hash, type Hex, type PublicClient, type WalletClient, isAddress } from "viem";
import { reputationRegistryAbi } from "../abi/index.js";
import type { AgentDetails } from "../types/agent.js";
import { InvalidScoreError, QovaError } from "../types/errors.js";
import { handleContractError } from "../utils/errors.js";

/**
 * Get the reputation score for an agent.
 * @param client - viem PublicClient.
 * @param contractAddress - ReputationRegistry contract address.
 * @param agent - The agent's Ethereum address.
 * @returns The score as a number (0-1000).
 * @throws {AgentNotRegisteredError} If the agent is not registered.
 */
export async function getScore(
	client: PublicClient,
	contractAddress: Address,
	agent: Address,
): Promise<number> {
	try {
		const result = await client.readContract({
			address: contractAddress,
			abi: reputationRegistryAbi,
			functionName: "getScore",
			args: [agent],
		});
		return Number(result);
	} catch (error) {
		throw handleContractError(error, "getScore"); // FIX: §2.1
	}
}

/**
 * Get full agent details struct from ReputationRegistry.
 * @param client - viem PublicClient.
 * @param contractAddress - ReputationRegistry contract address.
 * @param agent - The agent's Ethereum address.
 * @returns AgentDetails with score, lastUpdated, updateCount, isRegistered.
 */
export async function getAgentDetails(
	client: PublicClient,
	contractAddress: Address,
	agent: Address,
): Promise<AgentDetails> {
	try {
		const result = await client.readContract({
			address: contractAddress,
			abi: reputationRegistryAbi,
			functionName: "getAgentDetails",
			args: [agent],
		});
		return {
			score: Number(result.score),
			lastUpdated: BigInt(result.lastUpdated),
			updateCount: Number(result.updateCount),
			isRegistered: result.registered,
		};
	} catch (error) {
		throw handleContractError(error, "getAgentDetails"); // FIX: §2.1
	}
}

/**
 * Check whether an agent is registered in the ReputationRegistry.
 * @param client - viem PublicClient.
 * @param contractAddress - ReputationRegistry contract address.
 * @param agent - The agent's Ethereum address.
 * @returns True if the agent is registered.
 */
export async function isAgentRegistered(
	client: PublicClient,
	contractAddress: Address,
	agent: Address,
): Promise<boolean> {
	try {
		return await client.readContract({
			address: contractAddress,
			abi: reputationRegistryAbi,
			functionName: "isRegistered",
			args: [agent],
		});
	} catch (error) {
		throw handleContractError(error, "isAgentRegistered"); // FIX: §2.1
	}
}

/**
 * Register a new agent with an initial score of 0.
 * @param wallet - viem WalletClient for signing.
 * @param publicClient - viem PublicClient for simulation.
 * @param contractAddress - ReputationRegistry contract address.
 * @param agent - The agent address to register.
 * @returns The transaction hash.
 * @throws {AgentAlreadyRegisteredError} If the agent is already registered.
 */
export async function registerAgent(
	wallet: WalletClient,
	publicClient: PublicClient,
	contractAddress: Address,
	agent: Address,
): Promise<Hash> {
	try {
		const { request } = await publicClient.simulateContract({
			address: contractAddress,
			abi: reputationRegistryAbi,
			functionName: "registerAgent",
			args: [agent],
			account: wallet.account,
		});
		return wallet.writeContract(request);
	} catch (error) {
		throw handleContractError(error, "registerAgent"); // FIX: §2.1
	}
}

/**
 * Update an agent's reputation score.
 * @param wallet - viem WalletClient for signing.
 * @param publicClient - viem PublicClient for simulation.
 * @param contractAddress - ReputationRegistry contract address.
 * @param agent - The registered agent address.
 * @param score - The new score (0-1000).
 * @param reason - Application-defined reason tag (bytes32).
 * @returns The transaction hash.
 * @throws {InvalidScoreError} If score > 1000.
 * @throws {AgentNotRegisteredError} If agent is not registered.
 */
export async function updateScore(
	wallet: WalletClient,
	publicClient: PublicClient,
	contractAddress: Address,
	agent: Address,
	score: number,
	reason: Hex,
): Promise<Hash> {
	// FIX: §1.3 - Client-side validation before contract call
	if (score < 0 || score > 1000) {
		throw new InvalidScoreError(score);
	}
	if (!isAddress(agent)) {
		throw new QovaError(`Invalid agent address: ${agent}`, "INVALID_ADDRESS");
	}
	try {
		const { request } = await publicClient.simulateContract({
			address: contractAddress,
			abi: reputationRegistryAbi,
			functionName: "updateScore",
			args: [agent, score, reason],
			account: wallet.account,
		});
		return wallet.writeContract(request);
	} catch (error) {
		throw handleContractError(error, "updateScore"); // FIX: §2.1
	}
}

/**
 * Batch-update scores for multiple agents in a single transaction.
 * @param wallet - viem WalletClient for signing.
 * @param publicClient - viem PublicClient for simulation.
 * @param contractAddress - ReputationRegistry contract address.
 * @param agents - Array of registered agent addresses.
 * @param scores - Corresponding new scores (0-1000 each).
 * @param reasons - Corresponding reason tags (bytes32 each).
 * @returns The transaction hash.
 * @throws {ArrayLengthMismatchError} If array lengths don't match.
 */
export async function batchUpdateScores(
	wallet: WalletClient,
	publicClient: PublicClient,
	contractAddress: Address,
	agents: Address[],
	scores: number[],
	reasons: Hex[],
): Promise<Hash> {
	// FIX: §1.4 - Array length validation
	if (agents.length !== scores.length || scores.length !== reasons.length) {
		throw new QovaError(
			`Array length mismatch: agents(${agents.length}), scores(${scores.length}), reasons(${reasons.length})`,
			"ARRAY_LENGTH_MISMATCH",
		);
	}
	if (agents.length === 0) {
		throw new QovaError("Batch update requires at least one agent", "EMPTY_BATCH");
	}
	for (const score of scores) {
		if (score < 0 || score > 1000) throw new InvalidScoreError(score);
	}
	try {
		const { request } = await publicClient.simulateContract({
			address: contractAddress,
			abi: reputationRegistryAbi,
			functionName: "batchUpdateScores",
			args: [agents, scores, reasons],
			account: wallet.account,
		});
		return wallet.writeContract(request);
	} catch (error) {
		throw handleContractError(error, "batchUpdateScores"); // FIX: §2.1
	}
}
