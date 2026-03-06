import { query } from "../_generated/server";
import { v } from "convex/values";

/** Get score history snapshots for an agent (must be owned by user), ordered by time ascending. */
export const getHistory = query({
	args: { agent: v.string(), limit: v.optional(v.number()) },
	handler: async (ctx, { agent, limit }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const cap = limit ?? 100;
		const normalized = agent.toLowerCase();

		// Verify the agent belongs to the user
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();
		const owned = agents.some((a) => a.address.toLowerCase() === normalized);
		if (!owned) return [];

		const snapshots = await ctx.db
			.query("scoreSnapshots")
			.withIndex("by_agent")
			.collect();
		return snapshots
			.filter((s) => s.agent.toLowerCase() === normalized)
			.sort((a, b) => a.timestamp - b.timestamp)
			.slice(-cap);
	},
});

/** Leaderboard: user's agents ranked by score descending with rank number. */
export const getLeaderboard = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const cap = limit ?? 25;
		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();
		agents.sort((a, b) => b.score - a.score);
		return agents.slice(0, cap).map((a, i) => ({
			rank: i + 1,
			name: a.name,
			address: a.address,
			addressShort: a.addressShort,
			score: a.score,
			grade: a.grade,
			gradeColor: a.gradeColor,
			scoreFormatted: a.scoreFormatted,
			scorePercentage: a.scorePercentage,
		}));
	},
});
