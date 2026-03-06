import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { trackEvent } from "../lib/trackEvent";

const DEFAULT_WORKFLOWS = [
  {
    workflowId: "payment-volume",
    name: "Payment Volume Analysis",
    description:
      "Analyzes transaction volume, frequency, and consistency to assess payment reliability and throughput capacity.",
    weight: 0.35,
    icon: "CurrencyCircleDollar",
  },
  {
    workflowId: "longevity",
    name: "Operational Longevity",
    description:
      "Evaluates agent uptime, registration age, and historical activity patterns to measure operational maturity.",
    weight: 0.25,
    icon: "Timer",
  },
  {
    workflowId: "sanctions",
    name: "Sanctions & Compliance",
    description:
      "Screens agent addresses against known sanctions lists and checks for interaction with flagged contracts.",
    weight: 0.2,
    icon: "ShieldCheck",
  },
  {
    workflowId: "volatility",
    name: "Score Volatility",
    description:
      "Measures score stability over time. Lower volatility indicates predictable, reliable agent behavior.",
    weight: 0.2,
    icon: "ChartLineUp",
  },
];

/** Seed the 4 default CRE workflows if they don't already exist. */
export const seedWorkflows = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    let created = 0;
    for (const wf of DEFAULT_WORKFLOWS) {
      const existing = await ctx.db
        .query("creWorkflows")
        .withIndex("by_workflow_id", (q) => q.eq("workflowId", wf.workflowId))
        .unique();

      if (!existing) {
        await ctx.db.insert("creWorkflows", {
          ...wf,
          status: "active",
          totalRuns: 0,
          successRate: 100,
          createdAt: Date.now(),
        });
        created++;
      }
    }

    if (created > 0) {
      await trackEvent(ctx, {
        userId: identity.subject,
        action: "cre.seed_workflows",
        resource: "cre_workflow",
        metadata: { count: created },
      });
    }

    return created;
  },
});

/** Record a new CRE execution and update workflow stats. Requires authentication. */
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

    const validStatuses = new Set(["running", "completed", "failed"]);
    if (!validStatuses.has(args.status)) {
      throw new Error(`Invalid status: ${args.status}`);
    }

    const id = await ctx.db.insert("creExecutions", {
      workflowId: args.workflowId,
      agentAddress: args.agentAddress,
      status: args.status,
      inputScore: args.inputScore,
      startedAt: Date.now(),
    });

    // Update workflow stats
    const workflow = await ctx.db
      .query("creWorkflows")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", args.workflowId))
      .unique();

    if (workflow) {
      await ctx.db.patch(workflow._id, {
        lastRunAt: Date.now(),
        totalRuns: workflow.totalRuns + 1,
      });
    }

    await trackEvent(ctx, {
      userId: identity.subject,
      action: "cre.execute",
      resource: "cre_execution",
      resourceId: id,
      metadata: { workflowId: args.workflowId, agentAddress: args.agentAddress },
    });

    return id;
  },
});

/** Record a CRE execution from the server-side API route (no auth required). */
export const createServerExecution = mutation({
  args: {
    workflowId: v.string(),
    agentAddress: v.optional(v.string()),
    status: v.string(),
    inputScore: v.optional(v.number()),
    outputScore: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("creExecutions", {
      workflowId: args.workflowId,
      agentAddress: args.agentAddress,
      status: args.status,
      inputScore: args.inputScore,
      outputScore: args.outputScore,
      durationMs: args.durationMs,
      error: args.error,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
    });

    // Update workflow stats
    const workflow = await ctx.db
      .query("creWorkflows")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", args.workflowId))
      .unique();

    if (workflow) {
      const newTotal = workflow.totalRuns + 1;
      const successDelta = args.status === "completed" ? 0 : -1;
      const newSuccessRate = Math.max(0, Math.min(100,
        ((workflow.successRate * workflow.totalRuns) + (args.status === "completed" ? 100 : 0)) / newTotal
      ));
      await ctx.db.patch(workflow._id, {
        lastRunAt: Date.now(),
        totalRuns: newTotal,
        successRate: Math.round(newSuccessRate),
        avgDurationMs: args.durationMs
          ? Math.round(((workflow.avgDurationMs ?? 0) * workflow.totalRuns + args.durationMs) / newTotal)
          : workflow.avgDurationMs,
      });
    }
  },
});

/** Update workflow status (active/paused). Requires authentication. */
export const updateWorkflowStatus = mutation({
  args: {
    workflowId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, { workflowId, status }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const validStatuses = new Set(["active", "paused", "error"]);
    if (!validStatuses.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const workflow = await ctx.db
      .query("creWorkflows")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", workflowId))
      .unique();

    if (!workflow) throw new Error(`Workflow "${workflowId}" not found`);

    await ctx.db.patch(workflow._id, { status });
    await trackEvent(ctx, {
      userId: identity.subject,
      action: `cre.workflow_${status}`,
      resource: "cre_workflow",
      resourceId: workflowId,
      metadata: { previousStatus: workflow.status },
    });
  },
});
