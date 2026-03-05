import { query } from "../_generated/server";
import { v } from "convex/values";

/** Check if the currently authenticated user has World ID verification. */
export const getVerificationStatus = query({
	args: {},
	handler: async (ctx): Promise<{
		verified: boolean;
		level: string | null;
		verifiedAt: number | null;
	}> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { verified: false, level: null, verifiedAt: null };
		}

		const verification = await ctx.db
			.query("worldIdVerifications")
			.withIndex("by_user", (q) => q.eq("userId", identity.subject))
			.first();

		if (!verification) {
			return { verified: false, level: null, verifiedAt: null };
		}

		return {
			verified: true,
			level: verification.verificationLevel,
			verifiedAt: verification.verifiedAt,
		};
	},
});

/**
 * Check if a specific user (by Clerk ID) is World ID verified.
 * Used by agent detail pages to show verification status for agent owners.
 */
export const isUserVerified = query({
	args: { userId: v.string() },
	handler: async (ctx, { userId }): Promise<boolean> => {
		const verification = await ctx.db
			.query("worldIdVerifications")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		return verification !== null;
	},
});
