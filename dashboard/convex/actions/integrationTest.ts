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
			return { success: false, message: "Invalid Slack config -- check webhook URL and channel", duration: Date.now() - start };

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
			return { success: false, message: "Invalid Telegram config -- check bot token and chat ID", duration: Date.now() - start };

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
			return { success: false, message: "Invalid x402 config -- missing facilitator address", duration: Date.now() - start };

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
			return { success: false, message: "Invalid Coinbase config -- missing API key", duration: Date.now() - start };

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
			if (res.status === 401 || res.status === 403) return { success: false, message: "Invalid API key -- authentication failed", duration };
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
			return { success: false, message: "Invalid OpenAI config -- missing API key", duration: Date.now() - start };

		try {
			const res = await fetch("https://api.openai.com/v1/models", {
				method: "GET",
				headers: { Authorization: `Bearer ${config.apiKey}` },
				signal: AbortSignal.timeout(10_000),
			});
			const duration = Date.now() - start;
			if (res.ok) return { success: true, message: "OpenAI API key is valid", duration };
			if (res.status === 401) return { success: false, message: "Invalid API key -- authentication failed", duration };
			return { success: false, message: `OpenAI returned HTTP ${res.status}`, duration };
		} catch (err: unknown) {
			return { success: false, message: err instanceof Error ? err.message : "Request failed", duration: Date.now() - start };
		}
	},
});
