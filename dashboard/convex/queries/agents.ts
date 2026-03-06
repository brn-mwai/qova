import { query } from "../_generated/server";
import { v } from "convex/values";

/** List all agents sorted by score descending (includes cached stats). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    agents.sort((a, b) => b.score - a.score);
    return agents;
  },
});

/** Get a single agent by Ethereum address. */
export const getByAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const normalized = address.toLowerCase();
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_address")
      .collect();
    return agents.find((a) => a.address.toLowerCase() === normalized) ?? null;
  },
});

/** Get the top N agents by score. */
export const getTopAgents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const cap = limit ?? 10;
    const agents = await ctx.db.query("agents").collect();
    agents.sort((a, b) => b.score - a.score);
    return agents.slice(0, cap);
  },
});

/** Search agents by address substring (case-insensitive). */
export const search = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    if (!term || term.length < 2) return [];
    const lower = term.toLowerCase();
    const agents = await ctx.db.query("agents").collect();
    return agents
      .filter((a) => a.address.toLowerCase().includes(lower))
      .sort((a, b) => b.score - a.score);
  },
});

/** Count agents per grade for distribution charts. */
export const countByGrade = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const grades = [
      "AAA",
      "AA",
      "A",
      "BBB",
      "BB",
      "B",
      "CCC",
      "CC",
      "C",
      "D",
    ];
    const counts: Record<string, number> = {};
    for (const g of grades) {
      counts[g] = 0;
    }
    const agents = await ctx.db.query("agents").collect();
    for (const agent of agents) {
      if (agent.grade in counts) {
        counts[agent.grade]++;
      }
    }
    return counts;
  },
});
