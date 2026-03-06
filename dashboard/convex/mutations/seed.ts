import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Seed demo data for a new user's dashboard.
 * Called once after onboarding -- creates agents across all grades,
 * 90 days of score history, activity feed, CRE executions, and notifications
 * so every chart and page has compelling data.
 *
 * Idempotent: skips if user already has agents.
 */
export const seedDemoData = mutation({
	args: {},
	handler: async (ctx): Promise<{ seeded: boolean }> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return { seeded: false };

		const userId = identity.subject;

		// Idempotent guard
		const existing = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.first();

		if (existing) return { seeded: false };

		const now = Date.now();
		const DAY = 86400000;
		const HOUR = 3600000;
		const isoNow = new Date().toISOString();

		const gradeFor = (s: number): string => {
			if (s >= 950) return "AAA";
			if (s >= 900) return "AA";
			if (s >= 850) return "A";
			if (s >= 750) return "BBB";
			if (s >= 650) return "BB";
			if (s >= 550) return "B";
			if (s >= 450) return "CCC";
			if (s >= 350) return "CC";
			if (s >= 250) return "C";
			return "D";
		};

		const colorFor = (s: number): string => {
			if (s >= 700) return "#22C55E";
			if (s >= 400) return "#FACC15";
			return "#EF4444";
		};

		const shorten = (a: string): string =>
			`${a.slice(0, 6)}...${a.slice(-4)}`;

		// Deterministic pseudo-random from seed
		const seededRandom = (seed: number): number => {
			const x = Math.sin(seed * 9301 + 49297) * 49297;
			return x - Math.floor(x);
		};

		// ─── 10 Agents across all grade tiers ──────────────────────
		const demoAgents = [
			{ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", name: "AlphaTrader v2", description: "High-frequency trading agent on SKALE Europa", score: 962, dailyLimit: "500", monthlyLimit: "10000", totalTx: 1847, volume: "42,180 sFUEL" },
			{ address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", name: "VaultKeeper", description: "DeFi vault management and yield optimization", score: 921, dailyLimit: "1000", monthlyLimit: "25000", totalTx: 923, volume: "18,450 sFUEL" },
			{ address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", name: "PaymentRouter", description: "x402 payment processing and settlement agent", score: 874, dailyLimit: "250", monthlyLimit: "5000", totalTx: 2341, volume: "58,200 sFUEL" },
			{ address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", name: "OracleSync", description: "Cross-chain price feed oracle aggregator", score: 788, dailyLimit: "100", monthlyLimit: "2000", totalTx: 456, volume: "3,800 sFUEL" },
			{ address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "ComplianceBot", description: "KYC/AML compliance verification agent", score: 671, dailyLimit: "50", monthlyLimit: "1000", totalTx: 312, volume: "1,560 sFUEL" },
			{ address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", name: "DataOracle", description: "Off-chain data feed provider with Chainlink CRE", score: 583, dailyLimit: "75", monthlyLimit: "1500", totalTx: 189, volume: "890 sFUEL" },
			{ address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", name: "SwapEngine", description: "DEX aggregator and liquidity router", score: 492, dailyLimit: "200", monthlyLimit: "4000", totalTx: 734, volume: "12,400 sFUEL" },
			{ address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", name: "BridgeRelay", description: "Cross-chain bridge relay and verification", score: 378, dailyLimit: "150", monthlyLimit: "3000", totalTx: 98, volume: "2,100 sFUEL" },
			{ address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", name: "TestAgent-X", description: "Experimental agent in evaluation period", score: 267, dailyLimit: "25", monthlyLimit: "500", totalTx: 42, volume: "210 sFUEL" },
			{ address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", name: "LegacyWorker", description: "Deprecated agent pending decommission", score: 134, dailyLimit: "10", monthlyLimit: "100", totalTx: 15, volume: "45 sFUEL" },
		];

		// Insert all agents
		for (const agent of demoAgents) {
			const grade = gradeFor(agent.score);
			await ctx.db.insert("agents", {
				address: agent.address,
				name: agent.name,
				description: agent.description,
				score: agent.score,
				grade,
				gradeColor: colorFor(agent.score),
				scoreFormatted: String(agent.score).padStart(4, "0"),
				scorePercentage: agent.score / 10,
				lastUpdated: isoNow,
				updateCount: Math.floor(agent.totalTx / 10),
				isRegistered: true,
				addressShort: shorten(agent.address),
				explorerUrl: `https://elated-tan-skat.explorer.mainnet.skalenodes.com/address/${agent.address}`,
				ownerId: userId,
				chainId: 2046399126,
				budgetCurrency: "sFUEL",
				totalTxCount: agent.totalTx,
				totalVolume: agent.volume,
				successRate: `${(85 + seededRandom(agent.score) * 14).toFixed(1)}%`,
				dailyLimit: agent.dailyLimit,
				monthlyLimit: agent.monthlyLimit,
				perTxLimit: String(Math.floor(Number(agent.dailyLimit) / 5)),
				dailySpent: String(Math.floor(Number(agent.dailyLimit) * seededRandom(agent.score + 1) * 0.7)),
				monthlySpent: String(Math.floor(Number(agent.monthlyLimit) * seededRandom(agent.score + 2) * 0.6)),
				previousScore: agent.score - Math.floor(seededRandom(agent.score + 3) * 30 - 10),
				previousGrade: gradeFor(agent.score - Math.floor(seededRandom(agent.score + 3) * 30 - 10)),
			});
		}

		// ─── 90 days of score snapshots for top 5 agents ───────────
		for (let i = 0; i < 5; i++) {
			const agent = demoAgents[i];
			let score = agent.score - 80 + Math.floor(seededRandom(i * 100) * 40);
			for (let day = 90; day >= 0; day--) {
				// Gradual upward trend with noise
				const drift = seededRandom(i * 1000 + day) * 12 - 4;
				score = Math.max(100, Math.min(1000, Math.round(score + drift)));
				const ts = now - day * DAY + Math.floor(seededRandom(day + i) * HOUR * 4);
				const grade = gradeFor(score);
				await ctx.db.insert("scoreSnapshots", {
					agent: agent.address,
					score,
					grade,
					gradeColor: colorFor(score),
					timestamp: ts,
					ownerId: userId,
				});
			}
		}

		// Single current snapshot for remaining agents
		for (let i = 5; i < demoAgents.length; i++) {
			const agent = demoAgents[i];
			const grade = gradeFor(agent.score);
			await ctx.db.insert("scoreSnapshots", {
				agent: agent.address,
				score: agent.score,
				grade,
				gradeColor: colorFor(agent.score),
				timestamp: now,
				ownerId: userId,
			});
		}

		// ─── 60 activity entries spread over 30 days ───────────────
		const activityTypes = [
			{ type: "transaction", templates: ["Processed x402 payment", "Settled batch payment", "Forwarded payment to recipient"] },
			{ type: "score_update", templates: ["Score recalculated by CRE workflow", "Score adjusted after compliance check", "Quarterly score review completed"] },
			{ type: "registration", templates: ["Agent registered on SKALE Europa", "Agent re-registered after upgrade"] },
			{ type: "verification", templates: ["Sanctions screening passed", "Identity verification completed", "Compliance audit cleared"] },
			{ type: "budget_alert", templates: ["Daily budget 80% utilized", "Monthly budget threshold reached"] },
		];

		for (let j = 0; j < 60; j++) {
			const agentIdx = Math.floor(seededRandom(j * 7) * Math.min(8, demoAgents.length));
			const agent = demoAgents[agentIdx];
			const typeIdx = Math.floor(seededRandom(j * 13) * activityTypes.length);
			const actType = activityTypes[typeIdx];
			const templateIdx = Math.floor(seededRandom(j * 19) * actType.templates.length);
			const daysAgo = Math.floor(seededRandom(j * 23) * 30);
			const hoursOffset = Math.floor(seededRandom(j * 29) * 20);

			await ctx.db.insert("activity", {
				agent: agent.address,
				addressShort: shorten(agent.address),
				type: actType.type,
				description: actType.templates[templateIdx],
				amount: actType.type === "transaction" ? `${(seededRandom(j * 31) * 2).toFixed(3)} sFUEL` : undefined,
				txHash: actType.type === "transaction" ? `0x${j.toString(16).padStart(8, "0")}${"a]b1c2d3e4f5".repeat(5).slice(0, 56)}` : undefined,
				timestamp: now - daysAgo * DAY - hoursOffset * HOUR,
				ownerId: userId,
				chainId: 2046399126,
				currency: "sFUEL",
			});
		}

		// ─── CRE workflow executions (40 entries over 14 days) ─────
		const workflowIds = ["payment-volume", "longevity", "sanctions", "volatility"];
		for (let k = 0; k < 40; k++) {
			const wfIdx = Math.floor(seededRandom(k * 37) * workflowIds.length);
			const agentIdx = Math.floor(seededRandom(k * 41) * 5);
			const daysAgo = Math.floor(seededRandom(k * 43) * 14);
			const hoursOffset = Math.floor(seededRandom(k * 47) * 20);
			const startedAt = now - daysAgo * DAY - hoursOffset * HOUR;
			const durationMs = 800 + Math.floor(seededRandom(k * 53) * 4200);
			const failed = seededRandom(k * 59) < 0.08;
			const inputScore = 300 + Math.floor(seededRandom(k * 61) * 600);
			const delta = Math.floor(seededRandom(k * 67) * 40 - 10);

			await ctx.db.insert("creExecutions", {
				workflowId: workflowIds[wfIdx],
				agentAddress: demoAgents[agentIdx].address,
				status: failed ? "failed" : "completed",
				inputScore,
				outputScore: failed ? undefined : Math.max(100, Math.min(1000, inputScore + delta)),
				durationMs: failed ? undefined : durationMs,
				error: failed ? "Timeout: upstream data source unreachable" : undefined,
				startedAt,
				completedAt: failed ? undefined : startedAt + durationMs,
			});
		}

		// ─── Notifications ─────────────────────────────────────────
		const notifications = [
			{ type: "system", title: "Welcome to Qova", message: "Your dashboard is set up with demo agents. Register your own agents and connect a wallet to get started.", offset: 0 },
			{ type: "score_change", title: "AlphaTrader v2 upgraded to AAA", message: "Score increased from 948 to 962. This agent now qualifies for premium credit terms.", agentAddress: demoAgents[0].address, offset: 2 * HOUR },
			{ type: "budget_alert", title: "PaymentRouter daily budget 80%", message: "PaymentRouter has used 80% of its daily budget (200/250 sFUEL). Consider increasing limits.", agentAddress: demoAgents[2].address, offset: 5 * HOUR },
			{ type: "verification", title: "Sanctions check passed", message: "ComplianceBot passed its quarterly sanctions screening. No matches found across OFAC, EU, and UN lists.", agentAddress: demoAgents[4].address, offset: DAY },
			{ type: "score_change", title: "BridgeRelay downgraded to CC", message: "Score decreased from 412 to 378. Review agent activity and compliance status.", agentAddress: demoAgents[7].address, offset: 2 * DAY },
		];

		for (const n of notifications) {
			await ctx.db.insert("notifications", {
				userId,
				type: n.type,
				title: n.title,
				message: n.message,
				agentAddress: "agentAddress" in n ? n.agentAddress : undefined,
				read: n.offset > DAY,
				createdAt: now - n.offset,
			});
		}

		// ─── Audit log entries ─────────────────────────────────────
		const auditEntries = [
			{ action: "agent.register", resource: "agent", resourceId: demoAgents[0].address, metadata: '{"name":"AlphaTrader v2"}', offset: 30 * DAY },
			{ action: "agent.register", resource: "agent", resourceId: demoAgents[2].address, metadata: '{"name":"PaymentRouter"}', offset: 28 * DAY },
			{ action: "budget.set", resource: "agent", resourceId: demoAgents[0].address, metadata: '{"dailyLimit":"500","monthlyLimit":"10000"}', offset: 25 * DAY },
			{ action: "agent.verify", resource: "agent", resourceId: demoAgents[4].address, metadata: '{"result":"pass","source":"sanctions"}', offset: 7 * DAY },
			{ action: "api_key.create", resource: "api_key", metadata: '{"name":"Production Key","scopes":["read","write"]}', offset: 20 * DAY },
		];

		for (const entry of auditEntries) {
			await ctx.db.insert("auditLog", {
				userId,
				action: entry.action,
				resource: entry.resource,
				resourceId: entry.resourceId,
				metadata: entry.metadata,
				timestamp: now - entry.offset,
			});
		}

		return { seeded: true };
	},
});

/** Admin seed -- takes userId directly. Use from CLI: npx convex run mutations/seed:adminSeed '{"userId":"user_xxx"}' */
export const adminSeed = mutation({
	args: { userId: v.string() },
	handler: async (ctx, { userId }): Promise<{ seeded: boolean }> => {
		// Reuse the same seed logic but with explicit userId
		const existing = await ctx.db
			.query("agents")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.first();
		if (existing) return { seeded: false };

		// Delegate to internal helper by setting up the same context
		// We inline the seed logic here to avoid auth dependency
		const now = Date.now();
		const DAY = 86400000;
		const HOUR = 3600000;
		const isoNow = new Date().toISOString();

		const gradeFor = (s: number): string => {
			if (s >= 950) return "AAA"; if (s >= 900) return "AA"; if (s >= 850) return "A";
			if (s >= 750) return "BBB"; if (s >= 650) return "BB"; if (s >= 550) return "B";
			if (s >= 450) return "CCC"; if (s >= 350) return "CC"; if (s >= 250) return "C";
			return "D";
		};
		const colorFor = (s: number): string => s >= 700 ? "#22C55E" : s >= 400 ? "#FACC15" : "#EF4444";
		const shorten = (a: string): string => `${a.slice(0, 6)}...${a.slice(-4)}`;
		const seededRandom = (seed: number): number => { const x = Math.sin(seed * 9301 + 49297) * 49297; return x - Math.floor(x); };

		const demoAgents = [
			{ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", name: "AlphaTrader v2", description: "High-frequency trading agent on SKALE Europa", score: 962, dailyLimit: "500", monthlyLimit: "10000", totalTx: 1847, volume: "42,180 sFUEL" },
			{ address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", name: "VaultKeeper", description: "DeFi vault management and yield optimization", score: 921, dailyLimit: "1000", monthlyLimit: "25000", totalTx: 923, volume: "18,450 sFUEL" },
			{ address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", name: "PaymentRouter", description: "x402 payment processing and settlement agent", score: 874, dailyLimit: "250", monthlyLimit: "5000", totalTx: 2341, volume: "58,200 sFUEL" },
			{ address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", name: "OracleSync", description: "Cross-chain price feed oracle aggregator", score: 788, dailyLimit: "100", monthlyLimit: "2000", totalTx: 456, volume: "3,800 sFUEL" },
			{ address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "ComplianceBot", description: "KYC/AML compliance verification agent", score: 671, dailyLimit: "50", monthlyLimit: "1000", totalTx: 312, volume: "1,560 sFUEL" },
			{ address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", name: "DataOracle", description: "Off-chain data feed provider with Chainlink CRE", score: 583, dailyLimit: "75", monthlyLimit: "1500", totalTx: 189, volume: "890 sFUEL" },
			{ address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", name: "SwapEngine", description: "DEX aggregator and liquidity router", score: 492, dailyLimit: "200", monthlyLimit: "4000", totalTx: 734, volume: "12,400 sFUEL" },
			{ address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", name: "BridgeRelay", description: "Cross-chain bridge relay and verification", score: 378, dailyLimit: "150", monthlyLimit: "3000", totalTx: 98, volume: "2,100 sFUEL" },
			{ address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", name: "TestAgent-X", description: "Experimental agent in evaluation period", score: 267, dailyLimit: "25", monthlyLimit: "500", totalTx: 42, volume: "210 sFUEL" },
			{ address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", name: "LegacyWorker", description: "Deprecated agent pending decommission", score: 134, dailyLimit: "10", monthlyLimit: "100", totalTx: 15, volume: "45 sFUEL" },
		];

		for (const agent of demoAgents) {
			const grade = gradeFor(agent.score);
			await ctx.db.insert("agents", {
				address: agent.address, name: agent.name, description: agent.description,
				score: agent.score, grade, gradeColor: colorFor(agent.score),
				scoreFormatted: String(agent.score).padStart(4, "0"), scorePercentage: agent.score / 10,
				lastUpdated: isoNow, updateCount: Math.floor(agent.totalTx / 10), isRegistered: true,
				addressShort: shorten(agent.address),
				explorerUrl: `https://elated-tan-skat.explorer.mainnet.skalenodes.com/address/${agent.address}`,
				ownerId: userId, chainId: 2046399126, budgetCurrency: "sFUEL",
				totalTxCount: agent.totalTx, totalVolume: agent.volume,
				successRate: `${(85 + seededRandom(agent.score) * 14).toFixed(1)}%`,
				dailyLimit: agent.dailyLimit, monthlyLimit: agent.monthlyLimit,
				perTxLimit: String(Math.floor(Number(agent.dailyLimit) / 5)),
				dailySpent: String(Math.floor(Number(agent.dailyLimit) * seededRandom(agent.score + 1) * 0.7)),
				monthlySpent: String(Math.floor(Number(agent.monthlyLimit) * seededRandom(agent.score + 2) * 0.6)),
				previousScore: agent.score - Math.floor(seededRandom(agent.score + 3) * 30 - 10),
				previousGrade: gradeFor(agent.score - Math.floor(seededRandom(agent.score + 3) * 30 - 10)),
			});
		}

		for (let i = 0; i < 5; i++) {
			const agent = demoAgents[i];
			let score = agent.score - 80 + Math.floor(seededRandom(i * 100) * 40);
			for (let day = 90; day >= 0; day--) {
				const drift = seededRandom(i * 1000 + day) * 12 - 4;
				score = Math.max(100, Math.min(1000, Math.round(score + drift)));
				const ts = now - day * DAY + Math.floor(seededRandom(day + i) * HOUR * 4);
				await ctx.db.insert("scoreSnapshots", { agent: agent.address, score, grade: gradeFor(score), gradeColor: colorFor(score), timestamp: ts, ownerId: userId });
			}
		}
		for (let i = 5; i < demoAgents.length; i++) {
			const agent = demoAgents[i];
			await ctx.db.insert("scoreSnapshots", { agent: agent.address, score: agent.score, grade: gradeFor(agent.score), gradeColor: colorFor(agent.score), timestamp: now, ownerId: userId });
		}

		const activityTypes = [
			{ type: "transaction", templates: ["Processed x402 payment", "Settled batch payment", "Forwarded payment to recipient"] },
			{ type: "score_update", templates: ["Score recalculated by CRE workflow", "Score adjusted after compliance check"] },
			{ type: "registration", templates: ["Agent registered on SKALE Europa"] },
			{ type: "verification", templates: ["Sanctions screening passed", "Identity verification completed"] },
			{ type: "budget_alert", templates: ["Daily budget 80% utilized", "Monthly budget threshold reached"] },
		];
		for (let j = 0; j < 60; j++) {
			const agentIdx = Math.floor(seededRandom(j * 7) * Math.min(8, demoAgents.length));
			const agent = demoAgents[agentIdx];
			const typeIdx = Math.floor(seededRandom(j * 13) * activityTypes.length);
			const actType = activityTypes[typeIdx];
			const templateIdx = Math.floor(seededRandom(j * 19) * actType.templates.length);
			await ctx.db.insert("activity", {
				agent: agent.address, addressShort: shorten(agent.address), type: actType.type,
				description: actType.templates[templateIdx],
				amount: actType.type === "transaction" ? `${(seededRandom(j * 31) * 2).toFixed(3)} sFUEL` : undefined,
				timestamp: now - Math.floor(seededRandom(j * 23) * 30) * DAY - Math.floor(seededRandom(j * 29) * 20) * HOUR,
				ownerId: userId, chainId: 2046399126, currency: "sFUEL",
			});
		}

		const workflowIds = ["payment-volume", "longevity", "sanctions", "volatility"];
		for (let k = 0; k < 40; k++) {
			const wfIdx = Math.floor(seededRandom(k * 37) * workflowIds.length);
			const agentIdx = Math.floor(seededRandom(k * 41) * 5);
			const startedAt = now - Math.floor(seededRandom(k * 43) * 14) * DAY - Math.floor(seededRandom(k * 47) * 20) * HOUR;
			const durationMs = 800 + Math.floor(seededRandom(k * 53) * 4200);
			const failed = seededRandom(k * 59) < 0.08;
			const inputScore = 300 + Math.floor(seededRandom(k * 61) * 600);
			const delta = Math.floor(seededRandom(k * 67) * 40 - 10);
			await ctx.db.insert("creExecutions", {
				workflowId: workflowIds[wfIdx], agentAddress: demoAgents[agentIdx].address,
				status: failed ? "failed" : "completed", inputScore,
				outputScore: failed ? undefined : Math.max(100, Math.min(1000, inputScore + delta)),
				durationMs: failed ? undefined : durationMs,
				error: failed ? "Timeout: upstream data source unreachable" : undefined,
				startedAt, completedAt: failed ? undefined : startedAt + durationMs,
			});
		}

		await ctx.db.insert("notifications", { userId, type: "system", title: "Welcome to Qova", message: "Your dashboard has been set up with demo agents. Explore the platform and connect a wallet to get started.", read: false, createdAt: now });

		return { seeded: true };
	},
});
