"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
	parseSlackConfig,
	parseTelegramConfig,
	formatNotificationMessage,
	buildSlackPayload,
	type NotificationEvent,
} from "../lib/integrationHelpers";

/**
 * Central dispatch action called via scheduler from trackEvent.
 * Delivers notifications to all active integrations (Slack, Telegram, email).
 */
export const dispatchNotification = internalAction({
	args: {
		userId: v.string(),
		event: v.object({
			type: v.string(),
			title: v.string(),
			message: v.string(),
			agentAddress: v.optional(v.string()),
		}),
	},
	handler: async (ctx, { userId, event }): Promise<void> => {
		const integrations = await ctx.runQuery(
			internal.integrationConfigs.listByUserId,
			{ userId },
		);

		const eventStr = JSON.stringify(event);
		const notifEvent: NotificationEvent = event;

		// ─── Slack ────────────────────────────────────────────────────────
		const slackIntegrations = integrations.filter(
			(i) => i.type === "slack" && i.isActive,
		);
		for (const integration of slackIntegrations) {
			const config = parseSlackConfig(integration.config);
			if (!config) continue;

			let success = false;
			let error: string | undefined;
			try {
				const payload = buildSlackPayload(config.channel, notifEvent);
				const res = await fetch(config.webhookUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
					signal: AbortSignal.timeout(10_000),
				});
				success = res.ok;
				if (!success) {
					error = `HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`;
				}
			} catch (err: unknown) {
				error = err instanceof Error ? err.message : "Unknown error";
			}

			await ctx.runMutation(
				internal.mutations.notifications.logIntegrationDelivery,
				{ userId, integrationType: "slack", event: eventStr, success, error },
			);
		}

		// ─── Telegram ─────────────────────────────────────────────────────
		const telegramIntegrations = integrations.filter(
			(i) => i.type === "telegram" && i.isActive,
		);
		for (const integration of telegramIntegrations) {
			const config = parseTelegramConfig(integration.config);
			if (!config) continue;

			let success = false;
			let error: string | undefined;
			try {
				const text = formatNotificationMessage(notifEvent);
				const res = await fetch(
					`https://api.telegram.org/bot${config.botToken}/sendMessage`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							chat_id: config.chatId,
							text,
							parse_mode: "Markdown",
						}),
						signal: AbortSignal.timeout(10_000),
					},
				);
				const body = await res.json();
				success = res.ok && (body as { ok?: boolean }).ok === true;
				if (!success) {
					error = `HTTP ${res.status}: ${JSON.stringify(body).substring(0, 200)}`;
				}
			} catch (err: unknown) {
				error = err instanceof Error ? err.message : "Unknown error";
			}

			await ctx.runMutation(
				internal.mutations.notifications.logIntegrationDelivery,
				{
					userId,
					integrationType: "telegram",
					event: eventStr,
					success,
					error,
				},
			);
		}

		// ─── Email (via Resend) ───────────────────────────────────────────
		const resendApiKey = process.env.RESEND_API_KEY;
		if (resendApiKey) {
			// Check user email preferences
			const settings = await ctx.runQuery(
				internal.userSettings.getByUserId,
				{ userId },
			);

			// Map event type to the email preference toggle
			const emailEnabled = (() => {
				if (!settings) return true; // Default on if no settings saved
				switch (event.type) {
					case "score_change":
						return settings.emailScoreAlerts;
					case "budget_alert":
						return settings.emailBudgetAlerts;
					case "verification":
					case "system":
						return settings.emailSecurityAlerts;
					default:
						return true;
				}
			})();

			if (emailEnabled) {
				// Look up user email
				const user = await ctx.runQuery(
					internal.mutations.users.getByClerkId,
					{ clerkId: userId },
				);

				if (user?.email) {
					let success = false;
					let error: string | undefined;
					try {
						const res = await fetch("https://api.resend.com/emails", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${resendApiKey}`,
							},
							body: JSON.stringify({
								from: "Qova <notifications@qova.cc>",
								to: [user.email],
								subject: `[Qova] ${event.title}`,
								text: `${event.title}\n\n${event.message}${event.agentAddress ? `\n\nAgent: ${event.agentAddress}` : ""}`,
							}),
							signal: AbortSignal.timeout(10_000),
						});
						success = res.ok;
						if (!success) {
							error = `HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`;
						}
					} catch (err: unknown) {
						error = err instanceof Error ? err.message : "Unknown error";
					}

					await ctx.runMutation(
						internal.mutations.notifications.logIntegrationDelivery,
						{
							userId,
							integrationType: "email",
							event: eventStr,
							success,
							error,
						},
					);
				}
			}
		}
	},
});
