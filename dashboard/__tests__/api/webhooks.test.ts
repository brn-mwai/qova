/**
 * Webhook route tests.
 * Tests signature verification and secret validation.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
	headers: vi.fn(() =>
		Promise.resolve(
			new Map([
				["svix-id", "msg_test"],
				["svix-timestamp", "1234567890"],
				["svix-signature", "v1,invalid"],
			]),
		),
	),
}));

// Mock svix - Webhook must be a real class constructor
const mockVerify = vi.fn();
vi.mock("svix", () => ({
	Webhook: class MockWebhook {
		constructor(_secret: string) {}
		verify(body: string, headers: Record<string, string>) {
			return mockVerify(body, headers);
		}
	},
}));

// Mock Convex
vi.mock("convex/browser", () => ({
	ConvexHttpClient: class MockConvex {
		constructor(_url: string) {}
		mutation() {
			return Promise.resolve();
		}
	},
}));

vi.mock("../../../../../convex/_generated/api", () => ({
	api: {
		mutations: {
			users: {
				upsertUser: "upsertUser",
				deleteUser: "deleteUser",
			},
		},
	},
}));

describe("webhook route", () => {
	beforeEach(() => {
		vi.resetModules();
		mockVerify.mockReset();
	});

	it("returns 500 when CLERK_WEBHOOK_SECRET is missing", async () => {
		delete process.env.CLERK_WEBHOOK_SECRET;

		const { POST } = await import(
			"../../src/app/api/webhooks/clerk/route"
		);

		const request = new Request("http://localhost:3000/api/webhooks/clerk", {
			method: "POST",
			body: JSON.stringify({}),
		});

		const response = await POST(request);
		expect(response.status).toBe(500);
	});

	it("returns 400 when svix signature verification fails", async () => {
		process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
		mockVerify.mockImplementation(() => {
			throw new Error("Invalid signature");
		});

		const { POST } = await import(
			"../../src/app/api/webhooks/clerk/route"
		);

		const request = new Request("http://localhost:3000/api/webhooks/clerk", {
			method: "POST",
			body: JSON.stringify({ type: "user.created", data: {} }),
		});

		const response = await POST(request);
		expect(response.status).toBe(400);
	});

	it("returns 200 for valid user.created webhook", async () => {
		process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
		process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
		mockVerify.mockReturnValue({
			type: "user.created",
			data: {
				id: "user_123",
				email_addresses: [{ email_address: "test@example.com" }],
				first_name: "Test",
				last_name: "User",
				image_url: "https://img.clerk.com/test.jpg",
			},
		});

		const { POST } = await import(
			"../../src/app/api/webhooks/clerk/route"
		);

		const request = new Request("http://localhost:3000/api/webhooks/clerk", {
			method: "POST",
			body: JSON.stringify({}),
		});

		const response = await POST(request);
		expect(response.status).toBe(200);
	});
});
