import { mutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";

/** Upsert a single systemStats row by key. */
async function upsertStat(
  ctx: MutationCtx,
  key: string,
  value: string | number
): Promise<void> {
  const rows = await ctx.db
    .query("systemStats")
    .withIndex("by_key")
    .collect();
  const existing = rows.find((r) => r.key === key);
  if (existing) {
    await ctx.db.patch(existing._id, {
      value,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("systemStats", {
      key,
      value,
      updatedAt: Date.now(),
    });
  }
}

/** Recalculate and update system-wide stats from agent data. */
export const updateOverview = mutation({
  args: {
    totalAgents: v.optional(v.number()),
    avgScore: v.optional(v.number()),
    registeredCount: v.optional(v.number()),
    topGrade: v.optional(v.string()),
    lastSyncedAt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const agents = await ctx.db.query("agents").collect();

    const totalAgents = args.totalAgents ?? agents.length;
    const registeredCount =
      args.registeredCount ?? agents.filter((a) => a.isRegistered).length;

    let avgScore = 0;
    if (agents.length > 0) {
      const sum = agents.reduce((acc, a) => acc + a.score, 0);
      avgScore = args.avgScore ?? Math.round(sum / agents.length);
    }

    const sorted = [...agents].sort((a, b) => b.score - a.score);
    const topGrade = args.topGrade ?? sorted[0]?.grade ?? "N/A";

    await upsertStat(ctx, "totalAgents", totalAgents);
    await upsertStat(ctx, "avgScore", avgScore);
    await upsertStat(ctx, "registeredCount", registeredCount);
    await upsertStat(ctx, "topGrade", topGrade);
    await upsertStat(
      ctx,
      "lastSyncedAt",
      args.lastSyncedAt ?? new Date().toISOString()
    );
  },
});
