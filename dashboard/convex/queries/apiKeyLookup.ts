import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Look up an API key by its SHA-256 hash.
 * Used by the API auth middleware to validate Bearer tokens.
 * Returns null if not found or inactive.
 */
export const getByHash = query({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .first();

    if (!key) return null;
    if (!key.isActive) return null;
    if (key.expiresAt && key.expiresAt < Date.now()) return null;

    return {
      userId: key.userId,
      name: key.name,
      scopes: key.scopes,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
    };
  },
});
