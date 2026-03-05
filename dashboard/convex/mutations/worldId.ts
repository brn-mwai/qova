import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { trackEvent } from "../lib/trackEvent";

/**
 * Store a World ID verification proof after the IDKit widget verifies on the frontend.
 * Marks the user as World ID verified and records the proof for audit.
 */
export const verifyWorldId = mutation({
	args: {
		nullifierHash: v.string(),
		merkleRoot: v.string(),
		proof: v.string(),
		verificationLevel: v.string(), // "orb" | "device"
	},
	handler: async (ctx, args): Promise<{ success: boolean; alreadyVerified: boolean }> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			// Auth not available -- return gracefully to avoid retry loops
			return { success: false, alreadyVerified: false };
		}

		const userId = identity.subject;

		// Check if this nullifier hash has already been used (prevents double-verification)
		const existingProof = await ctx.db
			.query("worldIdVerifications")
			.withIndex("by_nullifier", (q) => q.eq("nullifierHash", args.nullifierHash))
			.first();

		if (existingProof) {
			return { success: false, alreadyVerified: true };
		}

		// Check if user is already verified
		const existingVerification = await ctx.db
			.query("worldIdVerifications")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		if (existingVerification) {
			return { success: true, alreadyVerified: true };
		}

		// Store the verification proof
		await ctx.db.insert("worldIdVerifications", {
			userId,
			nullifierHash: args.nullifierHash,
			merkleRoot: args.merkleRoot,
			proof: args.proof,
			verificationLevel: args.verificationLevel,
			verifiedAt: Date.now(),
		});

		// Update the user record to mark as World ID verified
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
			.first();

		if (user) {
			await ctx.db.patch(user._id, { worldIdVerified: true });
		}

		// Track the verification event
		await trackEvent(ctx, {
			userId,
			action: "worldid.verify",
			resource: "world_id",
			resourceId: args.nullifierHash,
			metadata: {
				verificationLevel: args.verificationLevel,
				merkleRoot: args.merkleRoot,
			},
			notification: {
				type: "verification",
				title: "World ID Verified",
				message: `Your identity has been verified via World ID (${args.verificationLevel} level). Your agents now receive a trust score boost.`,
			},
		});

		return { success: true, alreadyVerified: false };
	},
});
