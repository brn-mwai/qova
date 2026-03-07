"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import {
	parseSlackConfig,
	parseTelegramConfig,
	parseX402Config,
	parseCoinbaseConfig,
	parseOpenAIConfig,
	parseOpenClawConfig,
	parseMoltbookConfig,
	parseDiscordConfig,
	parseLangSmithConfig,
	parseVercelConfig,
	parseDuneConfig,
	parseWorldIdConfig,
	buildSlackPayload,
} from "../lib/integrationHelpers";

interface TestResult {
	success: boolean;
	message: string;
	duration: number;
}

/** Find integration from user's list by type. */
async function findIntegration(
	ctx: ActionCtx,
	integrationId: string,
): Promise<{ config: string } | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Not authenticated");

	const integrations = await ctx.runQuery(api.integrationConfigs.list, {});
	const match = integrations.find(
		(i: { type: string; isActive: boolean }) => i.type === integrationId && i.isActive,
	);
	return match ?? null;
}

/** Test Slack webhook by sending a test message. */
export const testSlack = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseSlackConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Slack config - check webhook URL and channel", duration: Date.now() - start };

		try {
			const payload = buildSlackPayload(config.channel, {
				type: "test",
				title: "Qova Test",
				message: "This is a test message from Qova. Your Slack integration is working.",
			});
			const res = await fetch(config.webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "Test message sent to Slack", duration };
			return { success: false, message: `Slack returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test Telegram bot by sending a test message. */
export const testTelegram = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseTelegramConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Telegram config - check bot token and chat ID", duration: Date.now() - start };

		try {
			const res = await fetch(
				`https://api.telegram.org/bot${config.botToken}/sendMessage`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						chat_id: config.chatId,
						text: "*Qova Test*\nThis is a test message from Qova. Your Telegram integration is working.",
						parse_mode: "Markdown",
					}),
					signal: AbortSignal.timeout(10_000),
				},
			);
			const body = (await res.json()) as { ok?: boolean; description?: string };
			const duration = Date.now() - start;
			if (res.ok && body.ok) return { success: true, message: "Test message sent to Telegram", duration };
			return { success: false, message: body.description ?? `HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test x402 by validating Ethereum address format. */
export const testX402 = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseX402Config(integration.config);
		if (!config)
			return { success: false, message: "Invalid x402 config - missing facilitator address", duration: Date.now() - start };

		const valid = /^0x[0-9a-fA-F]{40}$/.test(config.facilitator);
		const duration = Date.now() - start;
		if (valid) return { success: true, message: `Valid facilitator address: ${config.facilitator.slice(0, 6)}...${config.facilitator.slice(-4)}`, duration };
		return { success: false, message: "Invalid Ethereum address format (expected 0x + 40 hex chars)", duration };
	},
});

/** Test Coinbase API key by fetching latest Base block. */
export const testCoinbase = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseCoinbaseConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Coinbase config - missing API key", duration: Date.now() - start };

		try {
			const res = await fetch(
				"https://api.developer.coinbase.com/rpc/v1/base/block/latest",
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						"Cb-Access-Key": config.apiKey,
					},
					signal: AbortSignal.timeout(10_000),
				},
			);
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "Coinbase API key is valid", duration };
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid API key - authentication failed", duration };
			return { success: false, message: `Coinbase returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test OpenAI API key by listing models. */
export const testOpenAI = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseOpenAIConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid OpenAI config - missing API key", duration: Date.now() - start };

		try {
			const res = await fetch("https://api.openai.com/v1/models", {
				method: "GET",
				headers: { Authorization: `Bearer ${config.apiKey}` },
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "OpenAI API key is valid", duration };
			if (res.status === 401) return { success: false, message: "Invalid API key - authentication failed", duration };
			return { success: false, message: `OpenAI returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test OpenClaw Gateway connectivity. */
export const testOpenClaw = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseOpenClawConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid OpenClaw config - check Gateway URL", duration: Date.now() - start };

		try {
			const url = config.gatewayUrl.replace(/\/$/, "");
			const res = await fetch(`${url}/health`, {
				method: "GET",
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "OpenClaw Gateway is reachable", duration };
			return { success: false, message: `Gateway returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Gateway unreachable", duration: Date.now() - start };
		}
	},
});

/** Test Moltbook API key by fetching agent profile. */
export const testMoltbook = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseMoltbookConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Moltbook config - missing API key", duration: Date.now() - start };

		try {
			const res = await fetch("https://api.moltbook.com/agents/me", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
					"Content-Type": "application/json",
				},
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "Moltbook API key is valid", duration };
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid API key - authentication failed", duration };
			return { success: false, message: `Moltbook returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test Discord webhook by sending a test embed. */
export const testDiscord = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseDiscordConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Discord config - webhook URL must start with https://discord.com/api/webhooks/", duration: Date.now() - start };

		try {
			const res = await fetch(config.webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					embeds: [{
						title: "Qova Test",
						description: "This is a test message from Qova. Your Discord integration is working.",
						color: 0xFACC15,
						footer: { text: `Qova | ${new Date().toISOString()}` },
					}],
				}),
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok || res.status === 204) return { success: true, message: "Test embed sent to Discord", duration };
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid webhook URL - unauthorized", duration };
			return { success: false, message: `Discord returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test LangSmith API key by listing sessions. */
export const testLangSmith = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseLangSmithConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid LangSmith config - missing API key", duration: Date.now() - start };

		try {
			const res = await fetch("https://api.smith.langchain.com/api/v1/sessions?limit=1", {
				method: "GET",
				headers: { "x-api-key": config.apiKey },
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "LangSmith API key is valid", duration };
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid API key - authentication failed", duration };
			return { success: false, message: `LangSmith returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test Vercel API token by listing projects. */
export const testVercel = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseVercelConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Vercel config - missing API token", duration: Date.now() - start };

		try {
			const res = await fetch("https://api.vercel.com/v9/projects?limit=1", {
				method: "GET",
				headers: { Authorization: `Bearer ${config.apiToken}` },
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "Vercel API token is valid", duration };
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid token - authentication failed", duration };
			return { success: false, message: `Vercel returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test Dune Analytics API key by reading a public query. */
export const testDune = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseDuneConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid Dune config - missing API key", duration: Date.now() - start };

		try {
			const res = await fetch("https://api.dune.com/api/v1/query/1/results?limit=1", {
				method: "GET",
				headers: { "x-dune-api-key": config.apiKey },
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "Dune API key is valid", duration };
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid API key - authentication failed", duration };
			if (res.status === 404) return { success: true, message: "Dune API key is valid (query not found is expected)", duration };
			return { success: false, message: `Dune returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});

/** Test World ID app configuration by validating app_id format. */
export const testWorldId = action({
	args: { integrationId: v.string() },
	handler: async (ctx, { integrationId }): Promise<TestResult> => {
		const start = Date.now();
		const integration = await findIntegration(ctx, integrationId);
		if (!integration)
			return { success: false, message: "Integration not found or inactive", duration: Date.now() - start };

		const config = parseWorldIdConfig(integration.config);
		if (!config)
			return { success: false, message: "Invalid World ID config - app_id must start with app_", duration: Date.now() - start };

		const valid = /^app_[a-zA-Z0-9]{20,}$/.test(config.appId);
		const duration = Date.now() - start;
		if (valid) return { success: true, message: `Valid World ID app: ${config.appId.slice(0, 12)}...`, duration };
		return { success: false, message: "Invalid app_id format (expected app_ followed by 20+ alphanumeric chars)", duration };
	},
});
