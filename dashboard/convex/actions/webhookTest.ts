"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

/** Test a webhook by sending a real HTTP POST to its URL. */
export const testWebhook = action({
	args: { webhookId: v.id("webhooks") },
	handler: async (
		ctx,
		{ webhookId },
	): Promise<{
		success: boolean;
		statusCode?: number;
		duration: number;
		responseBody?: string;
	}> => {
		// Fetch webhook (via public query won't work for secret, use internal approach)
		// We need to get the raw webhook doc. Use a workaround: query all for the user
		// and find the matching one.
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");

		// We read webhooks via the query API (which strips secrets), but we need the URL
		const webhooks = await ctx.runQuery(
			api.queries.webhooks.listByUser,
			{ userId: identity.subject },
		);
		const webhook = webhooks.find(
			(w: { _id: string }) => w._id === webhookId,
		);
		if (!webhook) throw new Error("Webhook not found");

		// SSRF protection: reject internal/private IPs
		const urlObj = new URL(webhook.url);
		const hostname = urlObj.hostname.toLowerCase();
		const blocked = [
			"localhost", "127.0.0.1", "0.0.0.0", "[::1]",
		];
		const blockedPrefixes = [
			"10.", "172.16.", "172.17.", "172.18.", "172.19.",
			"172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
			"172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
			"172.30.", "172.31.", "192.168.",
		];
		if (
			blocked.includes(hostname) ||
			blockedPrefixes.some((p) => hostname.startsWith(p)) ||
			hostname.endsWith(".local") ||
			hostname.endsWith(".internal")
		) {
			throw new Error("Webhook URL must not point to internal or private addresses");
		}

		const testPayload = {
			event: "test",
			timestamp: new Date().toISOString(),
			data: {
				message: "This is a test webhook delivery from Qova",
				webhookId,
			},
		};

		const start = Date.now();
		let success = false;
		let statusCode: number | undefined;
		let responseBody: string | undefined;

		try {
			const response = await fetch(webhook.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Qova-Event": "test",
					"X-Qova-Delivery": crypto.randomUUID(),
				},
				body: JSON.stringify(testPayload),
				signal: AbortSignal.timeout(10000),
			});
			statusCode = response.status;
			responseBody = (await response.text()).substring(0, 500);
			success = response.ok;
		} catch (error: unknown) {
			responseBody =
				error instanceof Error ? error.message : "Unknown error";
			success = false;
		}

		const duration = Date.now() - start;

		// Log delivery
		await ctx.runMutation(api.mutations.webhooks.logDelivery, {
			webhookId,
			event: "test",
			payload: JSON.stringify(testPayload),
			statusCode,
			responseBody,
			duration,
			success,
		});

		return { success, statusCode, duration, responseBody };
	},
});
