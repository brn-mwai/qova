"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useConvexAvailable } from "@/components/providers/convex-provider";
import { useChainFilter } from "@/components/providers/chain-provider";
import { getChain, DEFAULT_CHAIN_ID } from "@/lib/chains";

/** All agents sorted by score descending. */
export function useAgentList(): Array<{
	_id: string;
	address: string;
	addressShort: string;
	name?: string;
	description?: string;
	score: number;
	grade: string;
	gradeColor: string;
	scoreFormatted: string;
	scorePercentage: number;
	lastUpdated: string;
	updateCount: number;
	isRegistered: boolean;
	explorerUrl: string;
	totalTxCount?: number;
	totalVolume?: string;
	successRate?: string;
	lastActivity?: string;
	dailyLimit?: string;
	monthlyLimit?: string;
	perTxLimit?: string;
	dailySpent?: string;
	monthlySpent?: string;
	chainId?: number;
	budgetCurrency?: string;
	previousScore?: number;
	previousGrade?: string;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.agents.list, available ? {} : "skip");
	return result ?? [];
}

/** Top N agents by score. */
export function useTopAgents(limit?: number): Array<{
	_id: string;
	address: string;
	addressShort: string;
	score: number;
	grade: string;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.agents.getTopAgents, available ? { limit } : "skip");
	return result ?? [];
}

/** Agent count per grade for charts. */
export function useGradeDistribution(): Record<string, number> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.agents.countByGrade, available ? {} : "skip");
	return (result as Record<string, number> | undefined) ?? {};
}

/** Recent activity entries, newest first. */
export function useRecentActivity(limit?: number): Array<{
	_id: string;
	agent: string;
	addressShort: string;
	type: string;
	description: string;
	amount?: string;
	txHash?: string;
	timestamp: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.activity.getRecent, available ? { limit } : "skip");
	return result ?? [];
}

/** System-wide overview stats. */
export function useSystemStats(): Record<string, string | number> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.stats.getOverview, available ? {} : "skip");
	return (result as Record<string, string | number> | undefined) ?? {};
}

/** Score history snapshots for a specific agent. */
export function useScoreHistory(agent: string, limit?: number): Array<{
	_id: string;
	agent: string;
	score: number;
	grade: string;
	gradeColor: string;
	timestamp: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(
		api.queries.scores.getHistory,
		available ? { agent, limit } : "skip",
	);
	return result ?? [];
}

/** Leaderboard: ranked agents. */
export function useLeaderboard(limit?: number): Array<{
	rank: number;
	name?: string;
	address: string;
	addressShort: string;
	score: number;
	grade: string;
	gradeColor: string;
	scoreFormatted: string;
	scorePercentage: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.scores.getLeaderboard, available ? { limit } : "skip");
	return result ?? [];
}

/** All CRE workflows. */
export function useCreWorkflows(): Array<{
	_id: string;
	workflowId: string;
	name: string;
	description: string;
	weight: number;
	status: string;
	lastRunAt?: number;
	avgDurationMs?: number;
	totalRuns: number;
	successRate: number;
	icon: string;
	createdAt: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.cre.listWorkflows, available ? {} : "skip");
	return result ?? [];
}

/** Single CRE workflow by ID. */
export function useCreWorkflow(workflowId: string): {
	_id: string;
	workflowId: string;
	name: string;
	description: string;
	weight: number;
	status: string;
	lastRunAt?: number;
	avgDurationMs?: number;
	totalRuns: number;
	successRate: number;
	icon: string;
	createdAt: number;
} | null {
	const available = useConvexAvailable();
	const result = useQuery(
		api.queries.cre.getWorkflow,
		available ? { workflowId } : "skip",
	);
	return result ?? null;
}

/** CRE executions for a workflow. */
export function useCreExecutions(workflowId: string, limit?: number): Array<{
	_id: string;
	workflowId: string;
	agentAddress?: string;
	status: string;
	inputScore?: number;
	outputScore?: number;
	durationMs?: number;
	error?: string;
	startedAt: number;
	completedAt?: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(
		api.queries.cre.getExecutions,
		available ? { workflowId, limit } : "skip",
	);
	return result ?? [];
}

/** Recent CRE executions across all workflows. */
export function useRecentCreExecutions(limit?: number): Array<{
	_id: string;
	workflowId: string;
	agentAddress?: string;
	status: string;
	inputScore?: number;
	outputScore?: number;
	durationMs?: number;
	error?: string;
	startedAt: number;
	completedAt?: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(
		api.queries.cre.getRecentExecutions,
		available ? { limit } : "skip",
	);
	return result ?? [];
}

/** Agents filtered by chain ID. */
export function useAgentsByChain(chainId: number): Array<{
	_id: string;
	address: string;
	score: number;
	grade: string;
	chainId?: number;
	budgetCurrency?: string;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.agents.listByChain, available ? { chainId } : "skip");
	return result ?? [];
}

/** Agent count per chain. */
export function useChainDistribution(): Array<{
	chainId: number;
	count: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.stats.chainDistribution, available ? {} : "skip");
	return result ?? [];
}

/** Budget totals grouped by currency. */
export function useCurrencyBreakdown(): Array<{
	currency: string;
	totalBudget: number;
	agentCount: number;
}> {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.stats.currencyBreakdown, available ? {} : "skip");
	return result ?? [];
}

/** World ID verification status for the current user. */
export function useWorldIdStatus(): {
	verified: boolean;
	level: string | null;
	verifiedAt: number | null;
} {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.worldId.getVerificationStatus, available ? {} : "skip");
	return result ?? { verified: false, level: null, verifiedAt: null };
}

/** Single agent by address. */
export function useAgentByAddress(address: string): {
	_id: string;
	address: string;
	addressShort: string;
	name?: string;
	description?: string;
	score: number;
	grade: string;
	gradeColor: string;
	scoreFormatted: string;
	scorePercentage: number;
	lastUpdated: string;
	updateCount: number;
	isRegistered: boolean;
	explorerUrl: string;
	totalTxCount?: number;
	totalVolume?: string;
	successRate?: string;
	lastActivity?: string;
	dailyLimit?: string;
	monthlyLimit?: string;
	perTxLimit?: string;
	dailySpent?: string;
	monthlySpent?: string;
	chainId?: number;
	budgetCurrency?: string;
} | null {
	const available = useConvexAvailable();
	const result = useQuery(api.queries.agents.getByAddress, available ? { address } : "skip");
	return result ?? null;
}

/** All agents filtered by the global chain selector. */
export function useFilteredAgentList(): ReturnType<typeof useAgentList> {
	const agents = useAgentList();
	const { selectedChainId } = useChainFilter();

	return useMemo(() => {
		if (selectedChainId === 0) return agents;
		return agents.filter((a) => a.chainId === selectedChainId);
	}, [agents, selectedChainId]);
}

/** Recent activity filtered by chain (cross-refs agent addresses). */
export function useFilteredRecentActivity(limit?: number): ReturnType<typeof useRecentActivity> {
	const activity = useRecentActivity(limit);
	const filteredAgents = useFilteredAgentList();
	const { selectedChainId } = useChainFilter();

	return useMemo(() => {
		if (selectedChainId === 0) return activity;
		const agentSet = new Set(filteredAgents.map((a) => a.address.toLowerCase()));
		return activity.filter((tx) => agentSet.has(tx.agent.toLowerCase()));
	}, [activity, filteredAgents, selectedChainId]);
}

/** Grade distribution filtered by chain. */
export function useFilteredGradeDistribution(): Record<string, number> {
	const agents = useFilteredAgentList();

	return useMemo(() => {
		const counts: Record<string, number> = {};
		for (const a of agents) {
			counts[a.grade] = (counts[a.grade] ?? 0) + 1;
		}
		return counts;
	}, [agents]);
}

/**
 * Returns the primary transaction currency for the currently selected chain.
 * SKALE Base uses USDC.e (agents transact in stablecoins, not gas tokens).
 * Base L1/L2 uses ETH.
 */
export function useChainCurrency(): string {
	const { selectedChainId } = useChainFilter();
	const chainId = selectedChainId !== 0 ? selectedChainId : DEFAULT_CHAIN_ID;
	return CHAIN_TX_CURRENCY[chainId] ?? "ETH";
}

/** Primary transaction currency per chain (not the gas token). */
const CHAIN_TX_CURRENCY: Record<number, string> = {
	1187947933: "USDC.e",  // SKALE Base - agents transact in bridged USDC
	8453: "ETH",           // Base mainnet
	84532: "ETH",          // Base Sepolia
};

/** Leaderboard filtered by chain. */
export function useFilteredLeaderboard(limit?: number): ReturnType<typeof useLeaderboard> {
	const leaderboard = useLeaderboard(limit);
	const filteredAgents = useFilteredAgentList();
	const { selectedChainId } = useChainFilter();

	return useMemo(() => {
		if (selectedChainId === 0) return leaderboard;
		const agentSet = new Set(filteredAgents.map((a) => a.address.toLowerCase()));
		return leaderboard
			.filter((entry) => agentSet.has(entry.address.toLowerCase()))
			.map((entry, i) => ({ ...entry, rank: i + 1 }));
	}, [leaderboard, filteredAgents, selectedChainId]);
}
