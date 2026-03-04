import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";

/** List API keys for the authenticated user (dashboard). */
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    // Strip keyHash — never expose to client
    return keys.map(({ keyHash, ...rest }) => rest);
  },
});

/**
 * List keys for a specific user (internal, called by API server).
 * No auth check — caller must verify authorization.
 */
export const listByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return keys.map(({ keyHash, ...rest }) => rest);
  },
});
