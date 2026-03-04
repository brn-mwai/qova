import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

/** Mark a notification as read. */
export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const notification = await ctx.db.get(id);
    if (!notification || notification.userId !== identity.subject) {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(id, { read: true });
  },
});

/** Mark all notifications as read for a user. */
export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (identity.subject !== userId) throw new Error("Forbidden");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});

/** Log an integration delivery result. Internal only. */
export const logIntegrationDelivery = internalMutation({
  args: {
    userId: v.string(),
    integrationType: v.string(),
    event: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("integrationDeliveries", {
      userId: args.userId,
      integrationType: args.integrationType,
      event: args.event,
      success: args.success,
      error: args.error,
      deliveredAt: Date.now(),
    });
  },
});

/**
 * Create a notification. Internal only -- should not be callable from the client.
 * Use internalMutation so only server-side code (actions, other mutations) can call it.
 */
export const create = internalMutation({
  args: {
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    agentAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      agentAddress: args.agentAddress,
      read: false,
      createdAt: Date.now(),
    });
  },
});
