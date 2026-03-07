/**
 * Data enrichment -- transforms raw on-chain data into API response shapes.
 * Uses @brnmwai/qova-core utilities for all formatting, grading, and coloring.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import {
	type AgentDetails,
	BLOCK_EXPLORERS,
	type BudgetStatus,
	CHAIN_IDS,
	formatBasisPoints,
	formatScore,
	formatTimestamp,
	formatWei,
	getGrade,
	getScoreColor,
	scoreToPercentage,
	shortenAddress,
	type TransactionStats,
} from "@brnmwai/qova-core";
import type { EnrichedAgentResponse } from "../types/api.js";

/**
 * Enrich raw AgentDetails into a full API response.
 * @param address - The agent's Ethereum address.
 * @param details - Raw on-chain AgentDetails from SDK.
 * @returns Enriched agent response with formatted fields.
 */
export function enrichAgentDetails(address: string, details: AgentDetails): EnrichedAgentResponse {
	const explorer = BLOCK_EXPLORERS[CHAIN_IDS.BASE_SEPOLIA] ?? "https://sepolia.basescan.org";

	return {
		agent: address,
		score: details.score,
		grade: getGrade(details.score),
		gradeColor: getScoreColor(details.score),
		scoreFormatted: formatScore(details.score),
		scorePercentage: scoreToPercentage(details.score),
		lastUpdated: formatTimestamp(details.lastUpdated).toISOString(),
		updateCount: details.updateCount,
		isRegistered: details.isRegistered,
		addressShort: shortenAddress(address),
		explorerUrl: `${explorer}/address/${address}`,
	};
}

/**
 * Enrich raw TransactionStats into an API response.
 * @param address - The agent's Ethereum address.
 * @param stats - Raw on-chain TransactionStats from SDK.
 * @returns Formatted transaction stats response.
 */
export function enrichTransactionStats(
	address: string,
	stats: TransactionStats,
): Record<string, unknown> {
	const successRateBps =
		stats.totalCount > 0 ? Math.round((stats.successCount / stats.totalCount) * 10000) : 0;

	return {
		agent: address,
		totalCount: stats.totalCount,
		totalVolume: `${formatWei(stats.totalVolume)} USDC.e`,
		totalVolumeWei: stats.totalVolume.toString(),
		successRate: formatBasisPoints(successRateBps),
		successRateBps,
		lastActivity: formatTimestamp(stats.lastActivityTimestamp).toISOString(),
		addressShort: shortenAddress(address),
	};
}

/**
 * Enrich raw BudgetStatus into an API response.
 * @param address - The agent's Ethereum address.
 * @param status - Raw on-chain BudgetStatus from SDK.
 * @returns Formatted budget status response.
 */
export function enrichBudgetStatus(address: string, status: BudgetStatus): Record<string, unknown> {
	const dailyLimit = status.dailyRemaining + status.dailySpent;
	const monthlyLimit = status.monthlyRemaining + status.monthlySpent;

	const dailyUtilization =
		dailyLimit > 0n ? (Number(status.dailySpent) / Number(dailyLimit)) * 100 : 0;
	const monthlyUtilization =
		monthlyLimit > 0n ? (Number(status.monthlySpent) / Number(monthlyLimit)) * 100 : 0;

	return {
		agent: address,
		config: {
			dailyLimit: `${formatWei(dailyLimit)} USDC.e`,
			monthlyLimit: `${formatWei(monthlyLimit)} USDC.e`,
			perTxLimit: `${formatWei(status.perTxLimit)} USDC.e`,
		},
		usage: {
			dailySpent: `${formatWei(status.dailySpent)} USDC.e`,
			monthlySpent: `${formatWei(status.monthlySpent)} USDC.e`,
			dailyRemaining: `${formatWei(status.dailyRemaining)} USDC.e`,
			monthlyRemaining: `${formatWei(status.monthlyRemaining)} USDC.e`,
		},
		utilization: {
			daily: `${dailyUtilization.toFixed(2)}%`,
			monthly: `${monthlyUtilization.toFixed(2)}%`,
		},
		raw: {
			dailyLimit: dailyLimit.toString(),
			monthlyLimit: monthlyLimit.toString(),
			perTxLimit: status.perTxLimit.toString(),
			dailySpent: status.dailySpent.toString(),
			monthlySpent: status.monthlySpent.toString(),
			dailyRemaining: status.dailyRemaining.toString(),
			monthlyRemaining: status.monthlyRemaining.toString(),
		},
	};
}
