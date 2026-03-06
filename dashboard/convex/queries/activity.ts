import { query } from "../_generated/server";
import { v } from "convex/values";

/** Get the most recent N activity items, newest first. */
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const cap = limit ?? 20;
    const items = await ctx.db
      .query("activity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(cap);
    return items;
  },
});

/** Get activity for a specific agent address. */
export const getByAgent = query({
  args: { agent: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { agent, limit }) => {
    const cap = limit ?? 50;
    const normalized = agent.toLowerCase();
    const items = await ctx.db
      .query("activity")
      .withIndex("by_agent")
      .collect();
    return items
      .filter((item) => item.agent.toLowerCase() === normalized)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, cap);
  },
});
