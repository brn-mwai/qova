import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Core Agent Tables ───────────────────────────────────────────
  agents: defineTable({
    address: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    score: v.number(),
    grade: v.string(),
    gradeColor: v.string(),
    scoreFormatted: v.string(),
    scorePercentage: v.number(),
    lastUpdated: v.string(),
    updateCount: v.number(),
    isRegistered: v.boolean(),
    addressShort: v.string(),
    explorerUrl: v.string(),
    // Owner (Clerk userId)
    ownerId: v.optional(v.string()),
    orgId: v.optional(v.string()),
    // Transaction stats (cached from API)
    totalTxCount: v.optional(v.number()),
    totalVolume: v.optional(v.string()),
    successRate: v.optional(v.string()),
    lastActivity: v.optional(v.string()),
    // Budget (cached from API)
    dailyLimit: v.optional(v.string()),
    monthlyLimit: v.optional(v.string()),
    perTxLimit: v.optional(v.string()),
    dailySpent: v.optional(v.string()),
    monthlySpent: v.optional(v.string()),
    // Score tracking
    previousScore: v.optional(v.number()),
    previousGrade: v.optional(v.string()),
    // Multi-chain support
    chainId: v.optional(v.number()), // default 8453 (Base)
    budgetCurrency: v.optional(v.string()), // default "ETH"
  })
    .index("by_address", ["address"])
    .index("by_score", ["score"])
    .index("by_grade", ["grade"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_chain", ["ownerId", "chainId"]),

  activity: defineTable({
    agent: v.string(),
    addressShort: v.string(),
    type: v.string(),
    description: v.string(),
    amount: v.optional(v.string()),
    txHash: v.optional(v.string()),
    timestamp: v.number(),
    ownerId: v.optional(v.string()),
    // Multi-chain support
    chainId: v.optional(v.number()),
    currency: v.optional(v.string()),
  })
    .index("by_agent", ["agent"])
    .index("by_type", ["type"])
    .index("by_timestamp", ["timestamp"])
    .index("by_owner", ["ownerId"]),

  scoreSnapshots: defineTable({
    agent: v.string(),
    score: v.number(),
    grade: v.string(),
    gradeColor: v.string(),
    timestamp: v.number(),
    ownerId: v.optional(v.string()),
  })
    .index("by_agent", ["agent"])
    .index("by_agent_time", ["agent", "timestamp"])
    .index("by_owner", ["ownerId"]),

  // ─── Auth & Users ────────────────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.string(), // "owner" | "admin" | "developer" | "viewer" | "billing"
    orgId: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
    onboardingComplete: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_org", ["orgId"]),

  // ─── API Keys & Webhooks ─────────────────────────────────────────
  apiKeys: defineTable({
    userId: v.string(),
    orgId: v.optional(v.string()),
    name: v.string(),
    keyPrefix: v.string(), // first 8 chars for display
    keyHash: v.string(), // SHA-256 hash of full key
    scopes: v.array(v.string()),
    lastUsedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  webhooks: defineTable({
    userId: v.string(),
    orgId: v.optional(v.string()),
    url: v.string(),
    events: v.array(v.string()),
    secret: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  webhookDeliveries: defineTable({
    webhookId: v.id("webhooks"),
    event: v.string(),
    payload: v.string(),
    statusCode: v.optional(v.number()),
    response: v.optional(v.string()),
    deliveredAt: v.number(),
    success: v.boolean(),
  })
    .index("by_webhook", ["webhookId"])
    .index("by_time", ["deliveredAt"]),

  integrationDeliveries: defineTable({
    userId: v.string(),
    integrationType: v.string(), // "slack" | "telegram" | "email"
    event: v.string(), // JSON stringified event
    success: v.boolean(),
    error: v.optional(v.string()),
    deliveredAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["integrationType"])
    .index("by_time", ["deliveredAt"]),

  // ─── Notifications ───────────────────────────────────────────────
  notifications: defineTable({
    userId: v.string(),
    type: v.string(), // "score_change" | "budget_alert" | "verification" | "system"
    title: v.string(),
    message: v.string(),
    agentAddress: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "read"]),

  // ─── Audit Log ───────────────────────────────────────────────────
  auditLog: defineTable({
    userId: v.string(),
    action: v.string(), // "agent.register" | "agent.verify" | "budget.set" | "api_key.create" | etc.
    resource: v.string(), // resource type
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.string()), // JSON stringified details
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"]),

  // ─── CRE Scoring Engine ─────────────────────────────────────────
  creWorkflows: defineTable({
    workflowId: v.string(), // "payment-volume" | "longevity" | "sanctions" | "volatility"
    name: v.string(),
    description: v.string(),
    weight: v.number(), // 0-1 contribution to composite score
    status: v.string(), // "active" | "paused" | "error"
    lastRunAt: v.optional(v.number()),
    avgDurationMs: v.optional(v.number()),
    totalRuns: v.number(),
    successRate: v.number(), // 0-100
    icon: v.string(), // Phosphor icon name
    createdAt: v.number(),
  })
    .index("by_workflow_id", ["workflowId"])
    .index("by_status", ["status"]),

  creExecutions: defineTable({
    workflowId: v.string(),
    agentAddress: v.optional(v.string()),
    status: v.string(), // "running" | "completed" | "failed"
    inputScore: v.optional(v.number()),
    outputScore: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    metadata: v.optional(v.string()), // JSON stringified
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_workflow", ["workflowId"])
    .index("by_workflow_status", ["workflowId", "status"])
    .index("by_agent", ["agentAddress"])
    .index("by_started", ["startedAt"]),

  // ─── Integrations ────────────────────────────────────────────────
  integrations: defineTable({
    userId: v.string(),
    orgId: v.optional(v.string()),
    type: v.string(), // "chainlink_cre" | "x402" | "base_rpc" | etc.
    name: v.string(),
    config: v.string(), // JSON stringified config
    isActive: v.boolean(),
    lastSyncAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"])
    .index("by_user_type", ["userId", "type"]),

  // ─── Team Members ──────────────────────────────────────────────
  teamMembers: defineTable({
    userId: v.string(), // Owner of this team
    memberEmail: v.string(),
    memberName: v.string(),
    role: v.string(), // "admin" | "editor" | "viewer"
    status: v.string(), // "active" | "invited" | "removed"
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["memberEmail"]),

  // ─── User Settings ─────────────────────────────────────────────
  userSettings: defineTable({
    userId: v.string(),
    // Notification preferences
    emailScoreAlerts: v.boolean(),
    emailBudgetAlerts: v.boolean(),
    emailSecurityAlerts: v.boolean(),
    emailWeeklyDigest: v.boolean(),
    pushScoreAlerts: v.boolean(),
    pushBudgetAlerts: v.boolean(),
    pushSecurityAlerts: v.boolean(),
    // Display preferences
    defaultChartRange: v.string(), // "7d" | "30d" | "90d"
    compactView: v.boolean(),
    timezone: v.string(),
  })
    .index("by_userId", ["userId"]),
});
