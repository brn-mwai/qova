import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Upsert user from Clerk webhook.
 *
 * SECURITY NOTE: This mutation accepts an arbitrary clerkId. It is called by the
 * Clerk webhook route (src/app/api/webhooks/clerk/route.ts) which verifies the
 * Svix signature before invoking this. Ideally this would be an internalMutation,
 * but ConvexHttpClient cannot call internal functions. The webhook route's Svix
 * verification serves as the auth gate. Do NOT call this from client-side code.
 */
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      role: "owner",
      onboardingComplete: false,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });
  },
});

/**
 * Delete user from Clerk webhook.
 * Same security note as upsertUser -- guarded by Svix verification in the webhook route.
 */
export const deleteUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const linkWallet = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error("Invalid Ethereum address");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { walletAddress });
  },
});

/**
 * Complete onboarding for the authenticated user.
 * Uses ctx.auth to verify identity -- no clerkId parameter needed.
 */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { onboardingComplete: true });
    }
  },
});
