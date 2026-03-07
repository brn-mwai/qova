import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { trackEvent } from "../lib/trackEvent";

const GRADE_THRESHOLDS: Array<{ grade: string; min: number }> = [
	{ grade: "AAA", min: 950 },
	{ grade: "AA", min: 900 },
	{ grade: "A", min: 850 },
	{ grade: "BBB", min: 750 },
	{ grade: "BB", min: 650 },
	{ grade: "B", min: 550 },
	{ grade: "CCC", min: 450 },
	{ grade: "CC", min: 350 },
	{ grade: "C", min: 250 },
	{ grade: "D", min: 0 },
];

function computeGrade(score: number): string {
	for (const { grade, min } of GRADE_THRESHOLDS) {
		if (score >= min) return grade;
	}
	return "D";
}

function computeGradeColor(score: number): string {
	if (score >= 700) return "#22C55E";
	if (score >= 400) return "#FACC15";
	return "#EF4444";
}

function shortenAddress(address: string): string {
	if (address.length < 10) return address;
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Insert or update an agent document by address. Requires authentication. */
export const upsertAgent = mutation({
	args: {
		address: v.string(),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		score: v.number(),
		grade: v.optional(v.string()),
		gradeColor: v.optional(v.string()),
		scoreFormatted: v.optional(v.string()),
		scorePercentage: v.optional(v.number()),
		lastUpdated: v.optional(v.string()),
		updateCount: v.optional(v.number()),
		isRegistered: v.optional(v.boolean()),
		addressShort: v.optional(v.string()),
		explorerUrl: v.optional(v.string()),
		totalTxCount: v.optional(v.number()),
		totalVolume: v.optional(v.string()),
		successRate: v.optional(v.string()),
		lastActivity: v.optional(v.string()),
		dailyLimit: v.optional(v.string()),
		monthlyLimit: v.optional(v.string()),
		perTxLimit: v.optional(v.string()),
		dailySpent: v.optional(v.string()),
		monthlySpent: v.optional(v.string()),
		chainId: v.optional(v.number()),
		budgetCurrency: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");

		const userId = identity.subject;

		// Only search within user's own agents
		const existing = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		const found = existing.find(
			(a) => a.address.toLowerCase() === args.address.toLowerCase(),
		);

		const grade = args.grade ?? computeGrade(args.score);
		const gradeColor = args.gradeColor ?? computeGradeColor(args.score);
		const scoreFormatted =
			args.scoreFormatted ??
			String(Math.max(0, Math.min(1000, Math.round(args.score)))).padStart(4, "0");
		const scorePercentage = args.scorePercentage ?? args.score / 10;
		const now = new Date().toISOString();

		if (found) {
			await ctx.db.patch(found._id, {
				score: args.score,
				grade,
				gradeColor,
				scoreFormatted,
				scorePercentage,
				lastUpdated: args.lastUpdated ?? now,
				updateCount: args.updateCount ?? found.updateCount + 1,
				isRegistered: args.isRegistered ?? found.isRegistered,
				addressShort: args.addressShort ?? found.addressShort,
				explorerUrl: args.explorerUrl ?? found.explorerUrl,
				...(args.name !== undefined && { name: args.name }),
				...(args.description !== undefined && { description: args.description }),
				...(args.totalTxCount !== undefined && { totalTxCount: args.totalTxCount }),
				...(args.totalVolume !== undefined && { totalVolume: args.totalVolume }),
				...(args.successRate !== undefined && { successRate: args.successRate }),
				...(args.lastActivity !== undefined && { lastActivity: args.lastActivity }),
				...(args.dailyLimit !== undefined && { dailyLimit: args.dailyLimit }),
				...(args.monthlyLimit !== undefined && { monthlyLimit: args.monthlyLimit }),
				...(args.perTxLimit !== undefined && { perTxLimit: args.perTxLimit }),
				...(args.dailySpent !== undefined && { dailySpent: args.dailySpent }),
				...(args.monthlySpent !== undefined && { monthlySpent: args.monthlySpent }),
				...(args.chainId !== undefined && { chainId: args.chainId }),
				...(args.budgetCurrency !== undefined && { budgetCurrency: args.budgetCurrency }),
			});
			await trackEvent(ctx, {
				userId,
				action: "agent.update",
				resource: "agent",
				resourceId: args.address,
				metadata: { score: args.score, grade },
			});
			return found._id;
		}

		const chainId = args.chainId ?? 1187947933;
		const explorerBase = chainId === 1187947933
			? "https://skale-base-explorer.skalenodes.com"
			: "https://basescan.org";

		const id = await ctx.db.insert("agents", {
			address: args.address,
			score: args.score,
			grade,
			gradeColor,
			scoreFormatted,
			scorePercentage,
			lastUpdated: args.lastUpdated ?? now,
			updateCount: args.updateCount ?? 0,
			isRegistered: args.isRegistered ?? true,
			addressShort: args.addressShort ?? shortenAddress(args.address),
			explorerUrl:
				args.explorerUrl ?? `${explorerBase}/address/${args.address}`,
			ownerId: userId,
			name: args.name,
			description: args.description,
			totalTxCount: args.totalTxCount,
			totalVolume: args.totalVolume,
			successRate: args.successRate,
			lastActivity: args.lastActivity,
			dailyLimit: args.dailyLimit,
			monthlyLimit: args.monthlyLimit,
			perTxLimit: args.perTxLimit,
			dailySpent: args.dailySpent,
			monthlySpent: args.monthlySpent,
			chainId,
			budgetCurrency: args.budgetCurrency ?? "USDC.e",
		});
		await trackEvent(ctx, {
			userId,
			action: "agent.register",
			resource: "agent",
			resourceId: args.address,
			metadata: { name: args.name, chainId, budgetCurrency: args.budgetCurrency ?? "USDC.e" },
			notification: {
				type: "system",
				title: "Agent Registered",
				message: `Agent ${shortenAddress(args.address)} has been registered with grade ${grade}.`,
				agentAddress: args.address,
			},
		});
		return id;
	},
});

/** Update score fields + derived grade and gradeColor for an agent. Requires authentication + ownership. */
export const updateScore = mutation({
	args: {
		address: v.string(),
		score: v.number(),
	},
	handler: async (ctx, { address, score }): Promise<boolean> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");

		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();
		const found = agents.find(
			(a) => a.address.toLowerCase() === address.toLowerCase(),
		);

		if (!found) return false;

		const grade = computeGrade(score);
		const gradeColor = computeGradeColor(score);

		const previousGrade = found.grade;
		const previousScore = found.score;
		await ctx.db.patch(found._id, {
			score,
			grade,
			gradeColor,
			scoreFormatted: String(
				Math.max(0, Math.min(1000, Math.round(score))),
			).padStart(4, "0"),
			scorePercentage: score / 10,
			lastUpdated: new Date().toISOString(),
			updateCount: found.updateCount + 1,
			previousScore,
			previousGrade,
		});

		const gradeChanged = previousGrade !== grade;
		await trackEvent(ctx, {
			userId: identity.subject,
			action: "agent.score_update",
			resource: "agent",
			resourceId: address,
			metadata: { previousScore: found.score, newScore: score, previousGrade, newGrade: grade },
			notification: gradeChanged
				? {
						type: "score_change",
						title: "Grade Changed",
						message: `Agent ${found.addressShort} moved from ${previousGrade} to ${grade} (score: ${score}).`,
						agentAddress: address,
					}
				: undefined,
		});

		return true;
	},
});

/** Delete an agent document by address. Requires authentication + ownership. */
export const removeAgent = mutation({
	args: { address: v.string() },
	handler: async (ctx, { address }): Promise<boolean> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");

		const agents = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
			.collect();
		const found = agents.find(
			(a) => a.address.toLowerCase() === address.toLowerCase(),
		);

		if (!found) return false;

		await ctx.db.delete(found._id);
		await trackEvent(ctx, {
			userId: identity.subject,
			action: "agent.remove",
			resource: "agent",
			resourceId: address,
			metadata: { name: found.name, grade: found.grade },
		});
		return true;
	},
});

/**
 * Server-side sync: update agent score and stats from CRE on-chain data.
 * No auth required -- called by the /api/cre/execute API route via ConvexHttpClient.
 */
export const syncFromChain = mutation({
	args: {
		address: v.string(),
		score: v.number(),
		totalTxCount: v.optional(v.number()),
		totalVolume: v.optional(v.string()),
		successRate: v.optional(v.string()),
		dailySpent: v.optional(v.string()),
		monthlySpent: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<boolean> => {
		const normalized = args.address.toLowerCase();
		const all = await ctx.db.query("agents").withIndex("by_address", (q) => q.eq("address", args.address)).collect();
		const found = all.find((a) => a.address.toLowerCase() === normalized);
		if (!found) return false;

		const grade = computeGrade(args.score);
		const gradeColor = computeGradeColor(args.score);
		const previousScore = found.score;
		const previousGrade = found.grade;

		await ctx.db.patch(found._id, {
			score: args.score,
			grade,
			gradeColor,
			scoreFormatted: String(Math.max(0, Math.min(1000, Math.round(args.score)))).padStart(4, "0"),
			scorePercentage: args.score / 10,
			lastUpdated: new Date().toISOString(),
			updateCount: found.updateCount + 1,
			previousScore,
			previousGrade,
			...(args.totalTxCount !== undefined && { totalTxCount: args.totalTxCount }),
			...(args.totalVolume !== undefined && { totalVolume: args.totalVolume }),
			...(args.successRate !== undefined && { successRate: args.successRate }),
			...(args.dailySpent !== undefined && { dailySpent: args.dailySpent }),
			...(args.monthlySpent !== undefined && { monthlySpent: args.monthlySpent }),
			lastActivity: new Date().toISOString(),
		});

		// Add score snapshot
		await ctx.db.insert("scoreSnapshots", {
			agent: args.address,
			score: args.score,
			grade,
			gradeColor,
			timestamp: Date.now(),
			ownerId: found.ownerId,
		});

		return true;
	},
});
