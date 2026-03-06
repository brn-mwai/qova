import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Upsert user notification and display settings.
 * Creates the settings row on first call, patches on subsequent calls.
 */
export const updateSettings = mutation({
	args: {
		emailScoreAlerts: v.optional(v.boolean()),
		emailBudgetAlerts: v.optional(v.boolean()),
		emailSecurityAlerts: v.optional(v.boolean()),
		emailWeeklyDigest: v.optional(v.boolean()),
		pushScoreAlerts: v.optional(v.boolean()),
		pushBudgetAlerts: v.optional(v.boolean()),
		pushSecurityAlerts: v.optional(v.boolean()),
		defaultChartRange: v.optional(v.string()),
		compactView: v.optional(v.boolean()),
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<void> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return;

		const userId = identity.subject;
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();

		if (existing) {
			const updates: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(args)) {
				if (value !== undefined) updates[key] = value;
			}
			if (Object.keys(updates).length > 0) {
				await ctx.db.patch(existing._id, updates);
			}
			return;
		}

		// Create with defaults, override with provided values
		await ctx.db.insert("userSettings", {
			userId,
			emailScoreAlerts: args.emailScoreAlerts ?? true,
			emailBudgetAlerts: args.emailBudgetAlerts ?? true,
			emailSecurityAlerts: args.emailSecurityAlerts ?? true,
			emailWeeklyDigest: args.emailWeeklyDigest ?? false,
			pushScoreAlerts: args.pushScoreAlerts ?? true,
			pushBudgetAlerts: args.pushBudgetAlerts ?? true,
			pushSecurityAlerts: args.pushSecurityAlerts ?? true,
			defaultChartRange: args.defaultChartRange ?? "30d",
			compactView: args.compactView ?? false,
			timezone: args.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
		});
	},
});
