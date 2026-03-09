/**
 * Contract wrapper for BudgetEnforcer.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { budgetEnforcerAbi } from "../abi/index.js";
import type { BudgetStatus } from "../types/budget.js";
import { handleContractError } from "../utils/errors.js";

/**
 * Configure spending limits for an agent.
 * @param wallet - viem WalletClient for signing.
 * @param publicClient - viem PublicClient for simulation.
 * @param contractAddress - BudgetEnforcer contract address.
 * @param agent - The agent address.
 * @param daily - Maximum daily spend.
 * @param monthly - Maximum monthly spend.
 * @param perTx - Maximum single-transaction spend.
 * @returns The transaction hash.
 */
export async function setBudget(
	wallet: WalletClient,
	publicClient: PublicClient,
	contractAddress: Address,
	agent: Address,
	daily: bigint,
	monthly: bigint,
	perTx: bigint,
): Promise<Hash> {
	try {
		const { request } = await publicClient.simulateContract({
			address: contractAddress,
			abi: budgetEnforcerAbi,
			functionName: "setBudget",
			args: [agent, daily, monthly, perTx],
			account: wallet.account ?? undefined,
		});
		return wallet.writeContract(request);
	} catch (error) {
		throw handleContractError(error, "setBudget"); // FIX: §2.1
	}
}

/**
 * Check whether a spend would be allowed under the agent's budget.
 * @param client - viem PublicClient.
 * @param contractAddress - BudgetEnforcer contract address.
 * @param agent - The agent address.
 * @param amount - The prospective spend amount.
 * @returns True if the spend would not breach any limit.
 */
export async function checkBudget(
	client: PublicClient,
	contractAddress: Address,
	agent: Address,
	amount: bigint,
): Promise<boolean> {
	try {
		return await client.readContract({
			address: contractAddress,
			abi: budgetEnforcerAbi,
			functionName: "checkBudget",
			args: [agent, amount],
		});
	} catch (error) {
		throw handleContractError(error, "checkBudget"); // FIX: §2.1
	}
}

/**
 * Record a spend against an agent's budget.
 * @param wallet - viem WalletClient for signing.
 * @param publicClient - viem PublicClient for simulation.
 * @param contractAddress - BudgetEnforcer contract address.
 * @param agent - The agent address.
 * @param amount - The spend amount.
 * @returns The transaction hash.
 * @throws {BudgetExceededError} If any limit would be breached.
 * @throws {NoBudgetSetError} If no budget is configured.
 */
export async function recordSpend(
	wallet: WalletClient,
	publicClient: PublicClient,
	contractAddress: Address,
	agent: Address,
	amount: bigint,
): Promise<Hash> {
	try {
		const { request } = await publicClient.simulateContract({
			address: contractAddress,
			abi: budgetEnforcerAbi,
			functionName: "recordSpend",
			args: [agent, amount],
			account: wallet.account ?? undefined,
		});
		return wallet.writeContract(request);
	} catch (error) {
		throw handleContractError(error, "recordSpend"); // FIX: §2.1
	}
}

/**
 * Get the current budget status for an agent, including remaining allowances.
 * @param client - viem PublicClient.
 * @param contractAddress - BudgetEnforcer contract address.
 * @param agent - The agent address.
 * @returns BudgetStatus with daily/monthly remaining and spent amounts.
 */
export async function getBudgetStatus(
	client: PublicClient,
	contractAddress: Address,
	agent: Address,
): Promise<BudgetStatus> {
	try {
		const result = await client.readContract({
			address: contractAddress,
			abi: budgetEnforcerAbi,
			functionName: "getBudgetStatus",
			args: [agent],
		});
		return {
			dailyRemaining: BigInt(result.dailyRemaining),
			monthlyRemaining: BigInt(result.monthlyRemaining),
			perTxLimit: BigInt(result.perTxLimit),
			dailySpent: BigInt(result.dailySpent),
			monthlySpent: BigInt(result.monthlySpent),
		};
	} catch (error) {
		throw handleContractError(error, "getBudgetStatus"); // FIX: §2.1
	}
}
