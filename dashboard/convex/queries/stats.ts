import { query } from "../_generated/server";
import { v } from "convex/values";

/** Get overview stats computed from the authenticated user's agents. */
export const getOverview = query({
	args: {},
	handler: async (ctx): Promise<Record<string, string | number>> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return {
				totalAgents: 0,
				avgScore: 0,
				registeredCount: 0,
				topGrade: "N/A",
				lastSyncedAt: new Date().toISOString(),
			};
		}

		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();

		const totalAgents = agents.length;
		const registeredCount = agents.filter((a) => a.isRegistered).length;
		const avgScore =
			totalAgents > 0
				? Math.round(agents.reduce((s, a) => s + a.score, 0) / totalAgents)
				: 0;
		const sorted = [...agents].sort((a, b) => b.score - a.score);
		const topGrade = sorted[0]?.grade ?? "N/A";

		return {
			totalAgents,
			avgScore,
			registeredCount,
			topGrade,
			lastSyncedAt: new Date().toISOString(),
		};
	},
});

/** Count of agents grouped by chainId. */
export const chainDistribution = query({
	args: {},
	handler: async (ctx): Promise<Array<{ chainId: number; count: number }>> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();

		const map = new Map<number, number>();
		for (const a of agents) {
			const cid = a.chainId ?? 1187947933;
			map.set(cid, (map.get(cid) ?? 0) + 1);
		}

		return Array.from(map.entries()).map(([chainId, count]) => ({
			chainId,
			count,
		}));
	},
});

/** Budget totals grouped by currency. */
export const currencyBreakdown = query({
	args: {},
	handler: async (
		ctx,
	): Promise<Array<{ currency: string; totalBudget: number; agentCount: number }>> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();

		const map = new Map<string, { totalBudget: number; agentCount: number }>();
		for (const a of agents) {
			const cur = a.budgetCurrency ?? "USDC.e";
			const entry = map.get(cur) ?? { totalBudget: 0, agentCount: 0 };
			entry.agentCount++;
			if (a.monthlyLimit) {
				const match = a.monthlyLimit.match(/([\d.]+)/);
				if (match) entry.totalBudget += Number.parseFloat(match[1]);
			}
			map.set(cur, entry);
		}

		return Array.from(map.entries()).map(([currency, data]) => ({
			currency,
			...data,
		}));
	},
});
