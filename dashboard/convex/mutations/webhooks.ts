import { v } from "convex/values";
import { mutation } from "../_generated/server";

/** Allowed webhook event types. */
const VALID_EVENTS = new Set([
  "agent.registered",
  "agent.score_updated",
  "agent.verified",
  "budget.exceeded",
  "budget.warning",
  "transaction.completed",
]);

/** Create a new webhook endpoint. */
export const create = mutation({
  args: {
    userId: v.string(),
    url: v.string(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify caller identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (identity.subject !== args.userId) throw new Error("Forbidden");

    // Validate URL is HTTPS
    try {
      const parsed = new URL(args.url);
      if (parsed.protocol !== "https:") {
        throw new Error("Webhook URL must use HTTPS");
      }
    } catch {
      throw new Error("Invalid webhook URL -- must be a valid HTTPS URL");
    }

    // Validate events
    for (const event of args.events) {
      if (!VALID_EVENTS.has(event)) {
        throw new Error(`Invalid event type: ${event}`);
      }
    }

    // Generate webhook secret using crypto
    const randomBytes = new Uint8Array(24);
    crypto.getRandomValues(randomBytes);
    const secret =
      "whsec_" +
      Array.from(randomBytes)
        .map((b) => b.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 32);

    const id = await ctx.db.insert("webhooks", {
      userId: args.userId,
      url: args.url,
      events: args.events,
      secret,
      isActive: true,
      createdAt: Date.now(),
    });

    return { id, secret };
  },
});

/** Toggle webhook active state. */
export const toggle = mutation({
  args: { id: v.id("webhooks"), isActive: v.boolean() },
  handler: async (ctx, { id, isActive }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const webhook = await ctx.db.get(id);
    if (!webhook || webhook.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.patch(id, { isActive });
  },
});

/** Delete a webhook. */
export const remove = mutation({
  args: { id: v.id("webhooks") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const webhook = await ctx.db.get(id);
    if (!webhook || webhook.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.delete(id);
  },
});
