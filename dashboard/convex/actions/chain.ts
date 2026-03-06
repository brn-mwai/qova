"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function computeGrade(score: number): string {
  const thresholds = [
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
  for (const { grade, min } of thresholds) {
    if (score >= min) return grade;
  }
  return "D";
}

function computeGradeColor(score: number): string {
  if (score >= 700) return "#22C55E";
  if (score >= 400) return "#FACC15";
  return "#EF4444";
}

/** Register an agent in Convex and log activity. */
export const registerAgent = action({
  args: { agent: v.string() },
  handler: async (ctx, { agent }): Promise<{ txHash: string; agent: string }> => {
    const id = await ctx.runMutation(api.mutations.agents.upsertAgent, {
      address: agent,
      score: 0,
      isRegistered: true,
      addressShort: shortenAddress(agent),
    });

    await ctx.runMutation(api.mutations.activity.logActivity, {
      agent,
      type: "Registration",
      description: `Agent ${shortenAddress(agent)} registered`,
    });

    // Return Convex document ID as reference (no on-chain tx yet)
    return { txHash: id, agent };
  },
});

/** Update agent score in Convex, record snapshot, and log activity. */
export const updateAgentScore = action({
  args: { address: v.string(), score: v.number() },
  handler: async (
    ctx,
    { address, score }
  ): Promise<{ txHash: string; agent: string; newScore: number }> => {
    const grade = computeGrade(score);
    const gradeColor = computeGradeColor(score);

    await ctx.runMutation(api.mutations.agents.updateScore, {
      address,
      score,
    });

    await ctx.runMutation(api.mutations.scores.addSnapshot, {
      agent: address,
      score,
      grade,
      gradeColor,
    });

    await ctx.runMutation(api.mutations.activity.logActivity, {
      agent: address,
      type: "ScoreUpdate",
      description: `Score updated to ${score} (${grade})`,
    });

    return { txHash: `score-${Date.now()}`, agent: address, newScore: score };
  },
});

/** Record a transaction event in Convex activity log. */
export const recordTransaction = action({
  args: {
    agent: v.string(),
    txHash: v.string(),
    amount: v.string(),
    txType: v.number(),
  },
  handler: async (
    ctx,
    { agent, txHash, amount, txType }
  ): Promise<{ txHash: string; agent: string }> => {
    const txTypeNames = ["Payment", "Transfer", "Swap", "Stake", "Other"];
    const typeName = txTypeNames[txType] ?? "Other";

    await ctx.runMutation(api.mutations.activity.logActivity, {
      agent,
      type: typeName,
      description: `${typeName} of ${amount}`,
      amount,
      txHash,
    });

    return { txHash, agent };
  },
});

/** Set budget limits for an agent in Convex. */
export const setBudget = action({
  args: {
    address: v.string(),
    dailyLimit: v.string(),
    monthlyLimit: v.string(),
    perTxLimit: v.string(),
  },
  handler: async (
    ctx,
    { address, dailyLimit, monthlyLimit, perTxLimit }
  ): Promise<{ txHash: string; agent: string }> => {
    // Fetch current agent score so upsert doesn't overwrite it
    const existing = await ctx.runQuery(api.queries.agents.getByAddress, {
      address,
    });
    const currentScore = existing?.score ?? 0;

    await ctx.runMutation(api.mutations.agents.upsertAgent, {
      address,
      score: currentScore,
      dailyLimit,
      monthlyLimit,
      perTxLimit,
    });

    await ctx.runMutation(api.mutations.activity.logActivity, {
      agent: address,
      type: "BudgetUpdate",
      description: `Budget set: daily=${dailyLimit}, monthly=${monthlyLimit}, perTx=${perTxLimit}`,
    });

    return { txHash: `budget-${Date.now()}`, agent: address };
  },
});

/** Verify an agent using Convex data. Returns trust verification result. */
export const verifyAgent = action({
  args: { agent: v.string() },
  handler: async (
    ctx,
    { agent }
  ): Promise<{
    agent: string;
    verified: boolean;
    score: number;
    grade: string;
    sanctionsClean: boolean;
    isRegistered: boolean;
    timestamp: string;
  }> => {
    // Look up agent from Convex
    const existing = await ctx.runQuery(api.queries.agents.getByAddress, {
      address: agent,
    });

    const now = new Date().toISOString();

    if (!existing) {
      // Agent not found -- return unverified result
      const result = {
        agent,
        verified: false,
        score: 0,
        grade: "D",
        sanctionsClean: true,
        isRegistered: false,
        timestamp: now,
      };

      await ctx.runMutation(api.mutations.activity.logActivity, {
        agent,
        type: "Verification",
        description: "Verification failed - agent not found",
      });

      return result;
    }

    // Compute verification: score >= 250 (grade C or above) and registered
    const verified = existing.score >= 250 && existing.isRegistered;
    const grade = computeGrade(existing.score);

    const result = {
      agent,
      verified,
      score: existing.score,
      grade,
      sanctionsClean: true, // No sanctions data yet -- default clean
      isRegistered: existing.isRegistered,
      timestamp: now,
    };

    await ctx.runMutation(api.mutations.activity.logActivity, {
      agent,
      type: "Verification",
      description: `Verification ${verified ? "passed" : "failed"} - Grade: ${grade}, Score: ${existing.score}`,
    });

    return result;
  },
});
