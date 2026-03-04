import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

export const list = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];
		return await ctx.db
			.query("integrations")
			.withIndex("by_user", (q) => q.eq("userId", identity.subject))
			.collect();
	},
});

/** Internal query for dispatch action -- no auth check, filtered by userId. */
export const listByUserId = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, { userId }) => {
		return await ctx.db
			.query("integrations")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
	},
});

export const connect = mutation({
	args: {
		integrationId: v.string(),
		name: v.string(),
		config: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");

		// Check if already exists
		const existing = await ctx.db
			.query("integrations")
			.withIndex("by_user_type", (q) =>
				q.eq("userId", identity.subject).eq("type", args.integrationId),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				config: args.config ?? "{}",
				isActive: true,
				lastSyncAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("integrations", {
			userId: identity.subject,
			type: args.integrationId,
			name: args.name,
			config: args.config ?? "{}",
			isActive: true,
			createdAt: Date.now(),
		});
	},
});

export const disconnect = mutation({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<void> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");

		const existing = await ctx.db
			.query("integrations")
			.withIndex("by_user_type", (q) =>
				q.eq("userId", identity.subject).eq("type", integrationId),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, { isActive: false });
		}
	},
});
