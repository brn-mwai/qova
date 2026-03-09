/**
 * CRE Execute API route tests.
 * Tests API key validation and auth enforcement.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
	auth: () => mockAuth(),
}));

// Mock viem
vi.mock("viem", () => ({
	createPublicClient: vi.fn(() => ({
		readContract: vi.fn(),
	})),
	createWalletClient: vi.fn(),
	http: vi.fn(),
	keccak256: vi.fn(() => "0x" + "00".repeat(32)),
	toHex: vi.fn((s: string) => s),
}));

vi.mock("viem/accounts", () => ({
	privateKeyToAccount: vi.fn(),
}));

vi.mock("viem/chains", () => ({
	baseSepolia: { id: 84532, name: "Base Sepolia" },
}));

// Mock Convex
vi.mock("convex/browser", () => ({
	ConvexHttpClient: vi.fn(() => ({
		mutation: vi.fn(),
	})),
}));

vi.mock("../../../../../convex/_generated/api", () => ({
	api: {
		mutations: {
			agents: { syncFromChain: "syncFromChain" },
			cre: { createServerExecution: "createServerExecution" },
		},
	},
}));

describe("CRE execute route auth", () => {
	beforeEach(() => {
		vi.resetModules();
		mockAuth.mockReset();
	});

	it("rejects requests with no API key and no session", async () => {
		mockAuth.mockResolvedValue({ userId: null });

		const { POST } = await import(
			"../../src/app/api/cre/execute/route"
		);

		const request = new Request("http://localhost:3000/api/cre/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentAddress: "0x" + "a".repeat(40) }),
		});

		const response = await POST(request);
		expect(response.status).toBe(401);

		const body = await response.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("rejects requests with wrong API key", async () => {
		process.env.CRE_API_KEY = "correct-key";
		mockAuth.mockResolvedValue({ userId: null });

		const { POST } = await import(
			"../../src/app/api/cre/execute/route"
		);

		const request = new Request("http://localhost:3000/api/cre/execute", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-cre-api-key": "wrong-key",
			},
			body: JSON.stringify({ agentAddress: "0x" + "a".repeat(40) }),
		});

		const response = await POST(request);
		expect(response.status).toBe(401);
	});

	it("requires agentAddress in request body", async () => {
		process.env.CRE_API_KEY = "test-key";

		const { POST } = await import(
			"../../src/app/api/cre/execute/route"
		);

		const request = new Request("http://localhost:3000/api/cre/execute", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-cre-api-key": "test-key",
			},
			body: JSON.stringify({}),
		});

		const response = await POST(request);
		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe("agentAddress required");
	});

	it("returns 503 when DEPLOYER_PRIVATE_KEY is missing", async () => {
		process.env.CRE_API_KEY = "test-key";
		delete process.env.DEPLOYER_PRIVATE_KEY;

		const { POST } = await import(
			"../../src/app/api/cre/execute/route"
		);

		const request = new Request("http://localhost:3000/api/cre/execute", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-cre-api-key": "test-key",
			},
			body: JSON.stringify({ agentAddress: "0x" + "a".repeat(40) }),
		});

		const response = await POST(request);
		expect(response.status).toBe(503);
	});
});
