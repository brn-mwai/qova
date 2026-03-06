import { mutation } from "../_generated/server";
import { v } from "convex/values";

/** Record a score snapshot for an agent at the current time. */
export const addSnapshot = mutation({
  args: {
    agent: v.string(),
    score: v.number(),
    grade: v.string(),
    gradeColor: v.string(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const id = await ctx.db.insert("scoreSnapshots", {
      agent: args.agent,
      score: args.score,
      grade: args.grade,
      gradeColor: args.gradeColor,
      timestamp: args.timestamp ?? Date.now(),
    });
    return id;
  },
});
