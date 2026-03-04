import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

export const get = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		return await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", identity.subject))
			.first();
	},
});

/** Internal query for dispatch action -- no auth check. */
export const getByUserId = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, { userId }) => {
		return await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
	},
});

export const save = mutation({
	args: {
		emailScoreAlerts: v.boolean(),
		emailBudgetAlerts: v.boolean(),
		emailSecurityAlerts: v.boolean(),
		emailWeeklyDigest: v.boolean(),
		pushScoreAlerts: v.boolean(),
		pushBudgetAlerts: v.boolean(),
		pushSecurityAlerts: v.boolean(),
		defaultChartRange: v.string(),
		compactView: v.boolean(),
		timezone: v.string(),
	},
	handler: async (ctx, args): Promise<void> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");

		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", identity.subject))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, args);
		} else {
			await ctx.db.insert("userSettings", {
				userId: identity.subject,
				...args,
			});
		}
	},
});
