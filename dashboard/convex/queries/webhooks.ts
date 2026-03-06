import { v } from "convex/values";
import { query } from "../_generated/server";

/** List webhooks for a user. Never returns the secret field. */
export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Verify caller identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== userId) return [];

    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Strip secret from response -- only expose masked prefix
    return webhooks.map(({ secret, ...rest }) => ({
      ...rest,
      secretMasked: `${secret.slice(0, 10)}...${"*".repeat(8)}`,
    }));
  },
});
