import { mutation } from "../_generated/server";
import { v } from "convex/values";

function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Record an activity event. */
export const logActivity = mutation({
  args: {
    agent: v.string(),
    addressShort: v.optional(v.string()),
    type: v.string(),
    description: v.string(),
    amount: v.optional(v.string()),
    txHash: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const id = await ctx.db.insert("activity", {
      agent: args.agent,
      addressShort: args.addressShort ?? shortenAddress(args.agent),
      type: args.type,
      description: args.description,
      amount: args.amount,
      txHash: args.txHash,
      timestamp: args.timestamp ?? Date.now(),
    });
    return id;
  },
});
