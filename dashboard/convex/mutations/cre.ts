import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

/**
 * Seed CRE workflows with default data.
 * Internal only -- not callable from client to prevent production data wipes.
 */
export const seedWorkflows = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing
    const existing = await ctx.db.query("creWorkflows").collect();
    for (const w of existing) await ctx.db.delete(w._id);

    const existingExecs = await ctx.db.query("creExecutions").collect();
    for (const e of existingExecs) await ctx.db.delete(e._id);

    const now = Date.now();
    const HOUR = 3600000;
    const DAY = 86400000;

    const workflows = [
      {
        workflowId: "payment-volume",
        name: "Payment Volume Analysis",
        description:
          "Analyzes transaction volume, frequency, and consistency over rolling windows. Higher consistent volume yields better scores.",
        weight: 0.35,
        status: "active",
        lastRunAt: now - HOUR * 2,
        avgDurationMs: 4200,
        totalRuns: 1847,
        successRate: 99.2,
        icon: "CurrencyCircleDollar",
        createdAt: now - DAY * 90,
      },
      {
        workflowId: "longevity",
        name: "Agent Longevity Score",
        description:
          "Measures on-chain account age, registration date, and continuous activity periods. Rewards long-standing agents.",
        weight: 0.25,
        status: "active",
        lastRunAt: now - HOUR * 1,
        avgDurationMs: 2800,
        totalRuns: 1847,
        successRate: 99.8,
        icon: "Timer",
        createdAt: now - DAY * 90,
      },
      {
        workflowId: "sanctions",
        name: "Sanctions & Compliance",
        description:
          "Cross-references agent addresses against OFAC, EU, and UN sanctions lists. Binary pass/fail with score penalty on failure.",
        weight: 0.25,
        status: "active",
        lastRunAt: now - HOUR * 3,
        avgDurationMs: 6100,
        totalRuns: 1846,
        successRate: 98.5,
        icon: "ShieldCheck",
        createdAt: now - DAY * 90,
      },
      {
        workflowId: "volatility",
        name: "Score Volatility Index",
        description:
          "Computes standard deviation of score changes over 30/60/90-day windows. Low volatility indicates stable, predictable behavior.",
        weight: 0.15,
        status: "active",
        lastRunAt: now - HOUR * 4,
        avgDurationMs: 3400,
        totalRuns: 1845,
        successRate: 99.5,
        icon: "ChartLineUp",
        createdAt: now - DAY * 90,
      },
    ];

    for (const w of workflows) {
      await ctx.db.insert("creWorkflows", w);
    }

    // Generate execution history for each workflow (last 7 days)
    const statuses = ["completed", "completed", "completed", "completed", "failed"];
    for (const w of workflows) {
      for (let i = 0; i < 40; i++) {
        const startedAt = now - Math.floor(Math.random() * 7 * DAY);
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const durationMs =
          status === "completed"
            ? w.avgDurationMs! + Math.floor(Math.random() * 2000) - 1000
            : Math.floor(Math.random() * 1000);

        await ctx.db.insert("creExecutions", {
          workflowId: w.workflowId,
          agentAddress:
            i % 3 === 0
              ? "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
              : i % 3 === 1
                ? "0x8Ba1f109551bD432803012645Ac136c89aFbEf99"
                : "0xaB5801a7D398351b8bE11C439e05C5B3259aeC9B",
          status,
          inputScore: 500 + Math.floor(Math.random() * 500),
          outputScore:
            status === "completed"
              ? 500 + Math.floor(Math.random() * 500)
              : undefined,
          durationMs: status === "completed" ? durationMs : undefined,
          error:
            status === "failed" ? "Upstream data source timeout" : undefined,
          startedAt,
          completedAt:
            status === "completed" ? startedAt + durationMs : undefined,
        });
      }
    }
  },
});

/** Record a new CRE execution. Requires authentication. */
export const createExecution = mutation({
  args: {
    workflowId: v.string(),
    agentAddress: v.optional(v.string()),
    status: v.string(),
    inputScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Validate status
    const validStatuses = new Set(["running", "completed", "failed"]);
    if (!validStatuses.has(args.status)) {
      throw new Error(`Invalid status: ${args.status}`);
    }

    return await ctx.db.insert("creExecutions", {
      workflowId: args.workflowId,
      agentAddress: args.agentAddress,
      status: args.status,
      inputScore: args.inputScore,
      startedAt: Date.now(),
    });
  },
});

/** Update workflow status. Requires authentication. */
export const updateWorkflowStatus = mutation({
  args: {
    workflowId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, { workflowId, status }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Validate status
    const validStatuses = new Set(["active", "paused", "error"]);
    if (!validStatuses.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const workflow = await ctx.db
      .query("creWorkflows")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", workflowId))
      .unique();

    if (workflow) {
      await ctx.db.patch(workflow._id, { status });
    }
  },
});
