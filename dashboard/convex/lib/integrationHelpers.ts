/**
 * Pure TypeScript config parsers + message formatters for integrations.
 * No Convex runtime dependencies -- imported by both actions and mutations.
 */

// ─── Config types ─────────────────────────────────────────────────────────────

export interface SlackConfig {
	webhookUrl: string;
	channel: string;
}

export interface TelegramConfig {
	botToken: string;
	chatId: string;
}

export interface X402Config {
	facilitator: string;
}

export interface CoinbaseConfig {
	apiKey: string;
}

export interface OpenAIConfig {
	apiKey: string;
}

export interface OpenClawConfig {
	gatewayUrl: string;
}

export interface MoltbookConfig {
	apiKey: string;
}

export interface DiscordConfig {
	webhookUrl: string;
}

export interface LangSmithConfig {
	apiKey: string;
}

export interface VercelConfig {
	apiToken: string;
}

export interface DuneConfig {
	apiKey: string;
}

export interface WorldIdConfig {
	appId: string;
}

// ─── Safe JSON parsers ────────────────────────────────────────────────────────

function safeParse(raw: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
}

export function parseSlackConfig(raw: string): SlackConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { webhookUrl, channel } = obj;
	if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://"))
		return null;
	if (typeof channel !== "string" || channel.length === 0) return null;
	return { webhookUrl, channel };
}

export function parseTelegramConfig(raw: string): TelegramConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { botToken, chatId } = obj;
	if (typeof botToken !== "string" || botToken.length === 0) return null;
	if (typeof chatId !== "string" || chatId.length === 0) return null;
	return { botToken, chatId };
}

export function parseX402Config(raw: string): X402Config | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { facilitator } = obj;
	if (typeof facilitator !== "string") return null;
	return { facilitator };
}

export function parseCoinbaseConfig(raw: string): CoinbaseConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { apiKey } = obj;
	if (typeof apiKey !== "string" || apiKey.length === 0) return null;
	return { apiKey };
}

export function parseOpenAIConfig(raw: string): OpenAIConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { apiKey } = obj;
	if (typeof apiKey !== "string" || apiKey.length === 0) return null;
	return { apiKey };
}

export function parseOpenClawConfig(raw: string): OpenClawConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { gatewayUrl } = obj;
	if (typeof gatewayUrl !== "string" || !gatewayUrl.startsWith("http"))
		return null;
	return { gatewayUrl };
}

export function parseMoltbookConfig(raw: string): MoltbookConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { apiKey } = obj;
	if (typeof apiKey !== "string" || apiKey.length === 0) return null;
	return { apiKey };
}

export function parseDiscordConfig(raw: string): DiscordConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { webhookUrl } = obj;
	if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://discord.com/api/webhooks/"))
		return null;
	return { webhookUrl };
}

export function parseLangSmithConfig(raw: string): LangSmithConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { apiKey } = obj;
	if (typeof apiKey !== "string" || apiKey.length === 0) return null;
	return { apiKey };
}

export function parseVercelConfig(raw: string): VercelConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { apiToken } = obj;
	if (typeof apiToken !== "string" || apiToken.length === 0) return null;
	return { apiToken };
}

export function parseDuneConfig(raw: string): DuneConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { apiKey } = obj;
	if (typeof apiKey !== "string" || apiKey.length === 0) return null;
	return { apiKey };
}

export function parseWorldIdConfig(raw: string): WorldIdConfig | null {
	const obj = safeParse(raw);
	if (!obj) return null;
	const { appId } = obj;
	if (typeof appId !== "string" || !appId.startsWith("app_")) return null;
	return { appId };
}

// ─── Message formatters ───────────────────────────────────────────────────────

export interface NotificationEvent {
	type: string;
	title: string;
	message: string;
	agentAddress?: string;
}

/** Markdown-formatted event text for Telegram / email. */
export function formatNotificationMessage(event: NotificationEvent): string {
	const addr = event.agentAddress
		? `\nAgent: \`${event.agentAddress}\``
		: "";
	return `*${event.title}*\n${event.message}${addr}`;
}

/** Slack Block Kit payload with text fallback. */
export function buildSlackPayload(
	channel: string,
	event: NotificationEvent,
): Record<string, unknown> {
	const addr = event.agentAddress
		? `\nAgent: \`${event.agentAddress}\``
		: "";
	return {
		channel,
		text: `${event.title}: ${event.message}`,
		blocks: [
			{
				type: "header",
				text: { type: "plain_text", text: event.title, emoji: true },
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `${event.message}${addr}`,
				},
			},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `Qova | ${event.type} | ${new Date().toISOString()}`,
					},
				],
			},
		],
	};
}
