import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
	emitWebhookEvent,
	getDeliveryLog,
	clearDeliveryLog,
	type WebhookConfig,
} from "../../src/services/webhooks.js";

describe("webhook delivery", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		clearDeliveryLog();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockWebhook(overrides?: Partial<WebhookConfig>): WebhookConfig {
		return {
			id: "wh_test_001",
			url: "https://example.com/webhook",
			secret: "whsec_test_secret_key",
			events: ["agent.registered", "agent.score.updated"],
			isActive: true,
			...overrides,
		};
	}

	it("delivers webhook with correct headers", async () => {
		let capturedHeaders: Record<string, string> = {};
		let capturedBody = "";

		globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
			capturedHeaders = Object.fromEntries(
				Object.entries(init.headers as Record<string, string>),
			);
			capturedBody = init.body as string;
			return new Response("ok", { status: 200 });
		});

		const webhook = mockWebhook();
		emitWebhookEvent([webhook], "agent.registered", { agent: "0x123" });

		// Wait for async delivery
		await new Promise((r) => setTimeout(r, 100));

		expect(capturedHeaders["Content-Type"]).toBe("application/json");
		expect(capturedHeaders["X-Qova-Event"]).toBe("agent.registered");
		expect(capturedHeaders["X-Qova-Signature"]).toMatch(/^sha256=[a-f0-9]+$/);
		expect(capturedHeaders["User-Agent"]).toContain("Qova-Webhooks");

		const parsed = JSON.parse(capturedBody);
		expect(parsed.event).toBe("agent.registered");
		expect(parsed.data.agent).toBe("0x123");
	});

	it("logs successful delivery", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

		const webhook = mockWebhook();
		emitWebhookEvent([webhook], "agent.registered", { agent: "0x123" });
		await new Promise((r) => setTimeout(r, 100));

		const log = getDeliveryLog("wh_test_001");
		expect(log.length).toBeGreaterThan(0);
		expect(log[0]!.status).toBe("success");
		expect(log[0]!.attempt).toBe(1);
	});

	it("skips inactive webhooks", async () => {
		globalThis.fetch = vi.fn();
		const webhook = mockWebhook({ isActive: false });
		emitWebhookEvent([webhook], "agent.registered", { agent: "0x123" });
		await new Promise((r) => setTimeout(r, 100));

		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("skips webhooks not subscribed to the event", async () => {
		globalThis.fetch = vi.fn();
		const webhook = mockWebhook({ events: ["transaction.recorded"] });
		emitWebhookEvent([webhook], "agent.registered", { agent: "0x123" });
		await new Promise((r) => setTimeout(r, 100));

		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("logs failed delivery with error", async () => {
		// Return a 500 on every attempt to fail all retries fast
		globalThis.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));

		const webhook = mockWebhook();
		emitWebhookEvent([webhook], "agent.registered", { agent: "0x123" });

		// Wait for retries (they use setTimeout delays, but in test they resolve quickly with mocked fetch)
		// The actual retry delays are 1s, 5s, 30s so we need to wait longer
		// For unit testing purposes, just check the first attempt was logged
		await new Promise((r) => setTimeout(r, 200));

		const log = getDeliveryLog("wh_test_001");
		expect(log.length).toBeGreaterThan(0);
		expect(log[0]!.status).toBe("failed");
		expect(log[0]!.httpStatus).toBe(500);
	});

	it("clearDeliveryLog resets state", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

		emitWebhookEvent([mockWebhook()], "agent.registered", { agent: "0x123" });
		await new Promise((r) => setTimeout(r, 100));

		expect(getDeliveryLog().length).toBeGreaterThan(0);
		clearDeliveryLog();
		expect(getDeliveryLog().length).toBe(0);
	});
});
