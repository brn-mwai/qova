/**
 * Contract wrapper for QovaCore -- the main entry point for agent actions.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Address, Hash, Hex, PublicClient, WalletClient } from "viem";
import { qovaCoreAbi } from "../abi/index.js";
import type { TransactionType } from "../types/transaction.js";
import { handleContractError } from "../utils/errors.js";

/**
 * Execute an agent action through QovaCore: validates budget, records the
 * transaction, and emits the AgentActionExecuted event.
 * @param wallet - viem WalletClient for signing.
 * @param publicClient - viem PublicClient for simulation.
 * @param contractAddress - QovaCore contract address.
 * @param agent - The agent address performing the action.
 * @param txHash - External transaction hash or identifier (bytes32).
 * @param amount - Value of the action.
 * @param txType - Classification of the transaction (0-4).
 * @returns The transaction hash.
 * @throws {BudgetExceededError} If the agent's budget check fails.
 */
export async function executeAgentAction(
	wallet: WalletClient,
	publicClient: PublicClient,
	contractAddress: Address,
	agent: Address,
	txHash: Hex,
	amount: bigint,
	txType: TransactionType,
): Promise<Hash> {
	try {
		const { request } = await publicClient.simulateContract({
			address: contractAddress,
			abi: qovaCoreAbi,
			functionName: "executeAgentAction",
			args: [agent, txHash, amount, txType],
			account: wallet.account ?? undefined,
		});
		return wallet.writeContract(request);
	} catch (error) {
		throw handleContractError(error, "executeAgentAction"); // FIX: §2.1
	}
}
