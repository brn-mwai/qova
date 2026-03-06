import { internalMutation } from "../_generated/server";

const AGENTS = [
	{ address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", score: 967, grade: "AAA", gradeColor: "#22C55E" },
	{ address: "0x8Ba1f109551bD432803012645Ac136c89aFbEf99", score: 923, grade: "AA", gradeColor: "#22C55E" },
	{ address: "0xaB5801a7D398351b8bE11C439e05C5B3259aeC9B", score: 863, grade: "A", gradeColor: "#22C55E" },
	{ address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", score: 782, grade: "BBB", gradeColor: "#22C55E" },
	{ address: "0xdD870fA1b7C4700F2BD7f44238821C26f7392148", score: 671, grade: "BB", gradeColor: "#FACC15" },
	{ address: "0x583031D1113aD414F02576BD6afaBfb302140225", score: 558, grade: "B", gradeColor: "#FACC15" },
	{ address: "0x4B0897b0513FdBeEc7C469D9aF4fA6C0752aB94D", score: 467, grade: "CCC", gradeColor: "#FACC15" },
	{ address: "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c", score: 187, grade: "D", gradeColor: "#EF4444" },
];

const TX_TYPES = ["Payment", "Swap", "Transfer", "Stake", "BudgetUpdate", "Verification"];

function shortenAddress(addr: string): string {
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function pad4(n: number): string {
	return String(n).padStart(4, "0");
}

/**
 * Seed the Convex database with demo agents, 90 days of score snapshots, and activity.
 * Internal only -- not callable from client-side code to prevent production data wipes.
 */
export const seedDemoData = internalMutation({
	args: {},
	handler: async (ctx) => {
		// Clear existing data
		const existingAgents = await ctx.db.query("agents").collect();
		for (const a of existingAgents) await ctx.db.delete(a._id);

		const existingActivity = await ctx.db.query("activity").collect();
		for (const a of existingActivity) await ctx.db.delete(a._id);

		const existingSnapshots = await ctx.db.query("scoreSnapshots").collect();
		for (const s of existingSnapshots) await ctx.db.delete(s._id);

		const existingStats = await ctx.db.query("systemStats").collect();
		for (const s of existingStats) await ctx.db.delete(s._id);

		const now = Date.now();
		const DAY = 86400000;

		// Insert agents
		for (const agent of AGENTS) {
			const tier = agent.score >= 700 ? 3 : agent.score >= 400 ? 2 : 1;
			await ctx.db.insert("agents", {
				address: agent.address,
				score: agent.score,
				grade: agent.grade,
				gradeColor: agent.gradeColor,
				scoreFormatted: pad4(agent.score),
				scorePercentage: agent.score / 10,
				lastUpdated: new Date(now - Math.floor(Math.random() * DAY * 2)).toISOString(),
				updateCount: 10 + Math.floor(agent.score / 25),
				isRegistered: true,
				addressShort: shortenAddress(agent.address),
				explorerUrl: `https://sepolia.basescan.org/address/${agent.address}`,
				totalTxCount: tier * 52 + Math.floor(agent.score / 10),
				totalVolume: `${(tier * 15.2 + agent.score / 100).toFixed(4)} ETH`,
				successRate: `${(90 + tier * 3).toFixed(2)}%`,
				lastActivity: new Date(now - Math.floor(Math.random() * DAY)).toISOString(),
				dailyLimit: "10.0000 ETH",
				monthlyLimit: "100.0000 ETH",
				perTxLimit: "5.0000 ETH",
				dailySpent: `${(tier * 1.5).toFixed(4)} ETH`,
				monthlySpent: `${(tier * 12.5).toFixed(4)} ETH`,
			});
		}

		// Generate 90 days of score snapshots per agent
		for (const agent of AGENTS) {
			for (let d = 90; d >= 0; d--) {
				const drift = Math.floor(Math.random() * 40) - 20;
				const score = Math.max(50, Math.min(1000, agent.score + drift));
				const grade = scoreToGrade(score);
				const gradeColor = scoreToColor(score);
				const ts = now - d * DAY + Math.floor(Math.random() * DAY * 0.5);
				await ctx.db.insert("scoreSnapshots", {
					agent: agent.address,
					score,
					grade,
					gradeColor,
					timestamp: ts,
				});
			}
		}

		// Generate 80 activity entries spread over 30 days
		for (let i = 0; i < 80; i++) {
			const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
			const type = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)];
			const amount = (Math.random() * 5 + 0.01).toFixed(4);
			const ts = now - Math.floor(Math.random() * 30 * DAY);
			await ctx.db.insert("activity", {
				agent: agent.address,
				addressShort: shortenAddress(agent.address),
				type,
				description: `${type} of ${amount} ETH`,
				amount: `${amount} ETH`,
				txHash: `0x${randomHex(64)}`,
				timestamp: ts,
			});
		}

		// System stats
		const totalAgents = AGENTS.length;
		const avgScore = Math.round(AGENTS.reduce((s, a) => s + a.score, 0) / totalAgents);
		const registered = AGENTS.filter((a) => a.score >= 400).length;

		await ctx.db.insert("systemStats", { key: "totalAgents", value: totalAgents, updatedAt: now });
		await ctx.db.insert("systemStats", { key: "avgScore", value: avgScore, updatedAt: now });
		await ctx.db.insert("systemStats", { key: "registeredCount", value: registered, updatedAt: now });
		await ctx.db.insert("systemStats", { key: "topGrade", value: "AAA", updatedAt: now });
		await ctx.db.insert("systemStats", { key: "lastSyncedAt", value: new Date(now).toISOString(), updatedAt: now });

		// ── CRE Workflows ──────────────────────────────────────────────
		const existingWorkflows = await ctx.db.query("creWorkflows").collect();
		for (const w of existingWorkflows) await ctx.db.delete(w._id);

		const existingExecs = await ctx.db.query("creExecutions").collect();
		for (const e of existingExecs) await ctx.db.delete(e._id);

		const HOUR = 3600000;

		const workflows = [
			{
				workflowId: "payment-volume",
				name: "Payment Volume Analysis",
				description: "Analyzes transaction volume, frequency, and consistency over rolling windows.",
				weight: 0.35,
				status: "active" as const,
				lastRunAt: now - HOUR * 2,
				avgDurationMs: 4200,
				totalRuns: 1847,
				successRate: 99.2,
				icon: "CurrencyCircleDollar",
				createdAt: now - DAY * 90,
			},
			{
				workflowId: "longevity",
				name: "Agent Longevity Score",
				description: "Measures on-chain account age, registration date, and continuous activity periods.",
				weight: 0.25,
				status: "active" as const,
				lastRunAt: now - HOUR * 1,
				avgDurationMs: 2800,
				totalRuns: 1847,
				successRate: 99.8,
				icon: "Timer",
				createdAt: now - DAY * 90,
			},
			{
				workflowId: "sanctions",
				name: "Sanctions & Compliance",
				description: "Cross-references agent addresses against OFAC, EU, and UN sanctions lists.",
				weight: 0.25,
				status: "active" as const,
				lastRunAt: now - HOUR * 3,
				avgDurationMs: 6100,
				totalRuns: 1846,
				successRate: 98.5,
				icon: "ShieldCheck",
				createdAt: now - DAY * 90,
			},
			{
				workflowId: "volatility",
				name: "Score Volatility Index",
				description: "Computes standard deviation of score changes over 30/60/90-day windows.",
				weight: 0.15,
				status: "active" as const,
				lastRunAt: now - HOUR * 4,
				avgDurationMs: 3400,
				totalRuns: 1845,
				successRate: 99.5,
				icon: "ChartLineUp",
				createdAt: now - DAY * 90,
			},
		];

		for (const w of workflows) {
			await ctx.db.insert("creWorkflows", w);
		}

		const creStatuses = ["completed", "completed", "completed", "completed", "failed"];
		for (const w of workflows) {
			for (let i = 0; i < 25; i++) {
				const startedAt = now - Math.floor(Math.random() * 7 * DAY);
				const st = creStatuses[Math.floor(Math.random() * creStatuses.length)];
				const dur = st === "completed"
					? (w.avgDurationMs ?? 3000) + Math.floor(Math.random() * 2000) - 1000
					: Math.floor(Math.random() * 1000);
				const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
				await ctx.db.insert("creExecutions", {
					workflowId: w.workflowId,
					agentAddress: agent.address,
					status: st,
					inputScore: 500 + Math.floor(Math.random() * 500),
					outputScore: st === "completed" ? 500 + Math.floor(Math.random() * 500) : undefined,
					durationMs: st === "completed" ? dur : undefined,
					error: st === "failed" ? "Upstream data source timeout" : undefined,
					startedAt,
					completedAt: st === "completed" ? startedAt + dur : undefined,
				});
			}
		}
	},
});

function scoreToGrade(score: number): string {
	if (score >= 950) return "AAA";
	if (score >= 900) return "AA";
	if (score >= 800) return "A";
	if (score >= 700) return "BBB";
	if (score >= 600) return "BB";
	if (score >= 500) return "B";
	if (score >= 400) return "CCC";
	if (score >= 300) return "CC";
	if (score >= 200) return "C";
	return "D";
}

function scoreToColor(score: number): string {
	if (score >= 700) return "#22C55E";
	if (score >= 400) return "#FACC15";
	return "#EF4444";
}

function randomHex(len: number): string {
	const chars = "0123456789abcdef";
	let result = "";
	for (let i = 0; i < len; i++) {
		result += chars[Math.floor(Math.random() * 16)];
	}
	return result;
}
