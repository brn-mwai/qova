import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { trackEvent } from "../lib/trackEvent";

const DEFAULT_WORKFLOWS = [
  {
    workflowId: "reputation-oracle",
    name: "Reputation Oracle",
    description:
      "Reads 3 on-chain contracts (ReputationRegistry, TransactionValidator, BudgetEnforcer), computes a composite score via AI-enhanced analysis, and writes updates on-chain.",
    weight: 0.35,
    icon: "ChartLineUp",
  },
  {
    workflowId: "transaction-monitor",
    name: "Transaction Monitor",
    description:
      "Listens for TransactionRecorded events on-chain, detects anomalies in volume and frequency, and triggers score recalculations.",
    weight: 0.25,
    icon: "CurrencyCircleDollar",
  },
  {
    workflowId: "budget-alert",
    name: "Budget Alert",
    description:
      "Monitors BudgetUpdated and BudgetExceeded events, checks utilization thresholds, and enforces spending limits per agent.",
    weight: 0.2,
    icon: "Timer",
  },
  {
    workflowId: "agent-verify",
    name: "Agent Verification",
    description:
      "Accepts HTTP proof submissions, verifies World ID proofs for sybil resistance, and writes verification status on-chain.",
    weight: 0.2,
    icon: "ShieldCheck",
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

/** Reset all CRE data: delete old workflows and executions, then re-seed workflows. */
export const resetWorkflows = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Delete all existing workflows
    const workflows = await ctx.db.query("creWorkflows").collect();
    for (const wf of workflows) {
      await ctx.db.delete(wf._id);
    }
    // Delete all existing executions
    const executions = await ctx.db.query("creExecutions").collect();
    for (const exec of executions) {
      await ctx.db.delete(exec._id);
    }
    // Re-seed with correct workflow definitions
    for (const wf of DEFAULT_WORKFLOWS) {
      await ctx.db.insert("creWorkflows", {
        ...wf,
        status: "active",
        totalRuns: 0,
        successRate: 100,
        createdAt: Date.now(),
      });
    }
    return DEFAULT_WORKFLOWS.length;
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
