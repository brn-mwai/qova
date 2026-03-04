import { mutation } from "../_generated/server";
import { v } from "convex/values";

const GRADE_THRESHOLDS: Array<{ grade: string; min: number }> = [
  { grade: "AAA", min: 950 },
  { grade: "AA", min: 900 },
  { grade: "A", min: 850 },
  { grade: "BBB", min: 750 },
  { grade: "BB", min: 650 },
  { grade: "B", min: 550 },
  { grade: "CCC", min: 450 },
  { grade: "CC", min: 350 },
  { grade: "C", min: 250 },
  { grade: "D", min: 0 },
];

function computeGrade(score: number): string {
  for (const { grade, min } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "D";
}

function computeGradeColor(score: number): string {
  if (score >= 700) return "#22C55E";
  if (score >= 400) return "#FACC15";
  return "#EF4444";
}

function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Insert or update an agent document by address. */
export const upsertAgent = mutation({
  args: {
    address: v.string(),
    score: v.number(),
    grade: v.optional(v.string()),
    gradeColor: v.optional(v.string()),
    scoreFormatted: v.optional(v.string()),
    scorePercentage: v.optional(v.number()),
    lastUpdated: v.optional(v.string()),
    updateCount: v.optional(v.number()),
    isRegistered: v.optional(v.boolean()),
    addressShort: v.optional(v.string()),
    explorerUrl: v.optional(v.string()),
    totalTxCount: v.optional(v.number()),
    totalVolume: v.optional(v.string()),
    successRate: v.optional(v.string()),
    lastActivity: v.optional(v.string()),
    dailyLimit: v.optional(v.string()),
    monthlyLimit: v.optional(v.string()),
    perTxLimit: v.optional(v.string()),
    dailySpent: v.optional(v.string()),
    monthlySpent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_address")
      .collect();
    const found = existing.find(
      (a) => a.address.toLowerCase() === args.address.toLowerCase()
    );

    const grade = args.grade ?? computeGrade(args.score);
    const gradeColor = args.gradeColor ?? computeGradeColor(args.score);
    const scoreFormatted =
      args.scoreFormatted ??
      String(Math.max(0, Math.min(1000, Math.round(args.score)))).padStart(
        4,
        "0"
      );
    const scorePercentage = args.scorePercentage ?? args.score / 10;
    const now = new Date().toISOString();

    if (found) {
      await ctx.db.patch(found._id, {
        score: args.score,
        grade,
        gradeColor,
        scoreFormatted,
        scorePercentage,
        lastUpdated: args.lastUpdated ?? now,
        updateCount: args.updateCount ?? found.updateCount + 1,
        isRegistered: args.isRegistered ?? found.isRegistered,
        addressShort: args.addressShort ?? found.addressShort,
        explorerUrl: args.explorerUrl ?? found.explorerUrl,
        ...(args.totalTxCount !== undefined && {
          totalTxCount: args.totalTxCount,
        }),
        ...(args.totalVolume !== undefined && {
          totalVolume: args.totalVolume,
        }),
        ...(args.successRate !== undefined && {
          successRate: args.successRate,
        }),
        ...(args.lastActivity !== undefined && {
          lastActivity: args.lastActivity,
        }),
        ...(args.dailyLimit !== undefined && { dailyLimit: args.dailyLimit }),
        ...(args.monthlyLimit !== undefined && {
          monthlyLimit: args.monthlyLimit,
        }),
        ...(args.perTxLimit !== undefined && { perTxLimit: args.perTxLimit }),
        ...(args.dailySpent !== undefined && { dailySpent: args.dailySpent }),
        ...(args.monthlySpent !== undefined && {
          monthlySpent: args.monthlySpent,
        }),
      });
      return found._id;
    }

    const id = await ctx.db.insert("agents", {
      address: args.address,
      score: args.score,
      grade,
      gradeColor,
      scoreFormatted,
      scorePercentage,
      lastUpdated: args.lastUpdated ?? now,
      updateCount: args.updateCount ?? 0,
      isRegistered: args.isRegistered ?? true,
      addressShort: args.addressShort ?? shortenAddress(args.address),
      explorerUrl:
        args.explorerUrl ??
        `https://sepolia.basescan.org/address/${args.address}`,
      totalTxCount: args.totalTxCount,
      totalVolume: args.totalVolume,
      successRate: args.successRate,
      lastActivity: args.lastActivity,
      dailyLimit: args.dailyLimit,
      monthlyLimit: args.monthlyLimit,
      perTxLimit: args.perTxLimit,
      dailySpent: args.dailySpent,
      monthlySpent: args.monthlySpent,
    });
    return id;
  },
});

/** Update score fields + derived grade and gradeColor for an agent. */
export const updateScore = mutation({
  args: {
    address: v.string(),
    score: v.number(),
  },
  handler: async (ctx, { address, score }): Promise<boolean> => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_address")
      .collect();
    const found = agents.find(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );

    if (!found) return false;

    const grade = computeGrade(score);
    const gradeColor = computeGradeColor(score);

    await ctx.db.patch(found._id, {
      score,
      grade,
      gradeColor,
      scoreFormatted: String(
        Math.max(0, Math.min(1000, Math.round(score)))
      ).padStart(4, "0"),
      scorePercentage: score / 10,
      lastUpdated: new Date().toISOString(),
      updateCount: found.updateCount + 1,
    });

    return true;
  },
});

/** Delete an agent document by address. */
export const removeAgent = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }): Promise<boolean> => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_address")
      .collect();
    const found = agents.find(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );

    if (!found) return false;

    await ctx.db.delete(found._id);
    return true;
  },
});
