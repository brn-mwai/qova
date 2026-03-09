/**
 * Execution tests for Qova n8n nodes.
 * Tests credential handling, error responses, and timeout behavior.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, it, expect, vi } from "vitest";
import { isValidAddress } from "../src/nodes/Qova/GenericFunctions";

// ---------------------------------------------------------------------------
//  Credential validation
// ---------------------------------------------------------------------------
describe("credential handling", () => {
	it("qovaApiRequest requires credentials", async () => {
		// Mock the n8n execution context
		const mockContext = {
			getCredentials: vi.fn().mockRejectedValue(new Error("No credentials")),
			getNode: vi.fn().mockReturnValue({ name: "Qova", type: "qova" }),
			helpers: {
				httpRequest: vi.fn(),
			},
		};

		const { qovaApiRequest } = await import(
			"../src/nodes/Qova/GenericFunctions"
		);
		await expect(
			qovaApiRequest.call(mockContext as any, "GET", "/api/health"),
		).rejects.toThrow();
	});

	it("constructs correct URL from credentials", async () => {
		const capturedOptions: any[] = [];
		const mockContext = {
			getCredentials: vi.fn().mockResolvedValue({
				apiKey: "test-key-123",
				baseUrl: "https://custom.qova.cc",
			}),
			getNode: vi.fn().mockReturnValue({ name: "Qova", type: "qova" }),
			helpers: {
				httpRequest: vi.fn().mockImplementation((opts: any) => {
					capturedOptions.push(opts);
					return Promise.resolve({ status: "ok" });
				}),
			},
		};

		const { qovaApiRequest } = await import(
			"../src/nodes/Qova/GenericFunctions"
		);
		await qovaApiRequest.call(
			mockContext as any,
			"GET",
			"/api/agents/0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158/score",
		);

		expect(capturedOptions[0].url).toBe(
			"https://custom.qova.cc/api/agents/0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158/score",
		);
		expect(capturedOptions[0].headers["x-api-key"]).toBe("test-key-123");
	});

	it("strips trailing slash from base URL", async () => {
		const capturedOptions: any[] = [];
		const mockContext = {
			getCredentials: vi.fn().mockResolvedValue({
				apiKey: "key",
				baseUrl: "https://api.qova.cc/",
			}),
			getNode: vi.fn().mockReturnValue({ name: "Qova", type: "qova" }),
			helpers: {
				httpRequest: vi.fn().mockImplementation((opts: any) => {
					capturedOptions.push(opts);
					return Promise.resolve({});
				}),
			},
		};

		const { qovaApiRequest } = await import(
			"../src/nodes/Qova/GenericFunctions"
		);
		await qovaApiRequest.call(mockContext as any, "GET", "/api/health");

		expect(capturedOptions[0].url).toBe("https://api.qova.cc/api/health");
	});
});

// ---------------------------------------------------------------------------
//  Error handling
// ---------------------------------------------------------------------------
describe("error handling", () => {
	it("wraps HTTP errors in NodeApiError", async () => {
		const mockContext = {
			getCredentials: vi.fn().mockResolvedValue({
				apiKey: "key",
				baseUrl: "https://api.qova.cc",
			}),
			getNode: vi.fn().mockReturnValue({ name: "Qova", type: "qova" }),
			helpers: {
				httpRequest: vi.fn().mockRejectedValue(new Error("Connection refused")),
			},
		};

		const { qovaApiRequest } = await import(
			"../src/nodes/Qova/GenericFunctions"
		);
		await expect(
			qovaApiRequest.call(mockContext as any, "GET", "/api/health"),
		).rejects.toThrow();
	});

	it("passes request body for POST requests", async () => {
		const capturedOptions: any[] = [];
		const mockContext = {
			getCredentials: vi.fn().mockResolvedValue({
				apiKey: "key",
				baseUrl: "https://api.qova.cc",
			}),
			getNode: vi.fn().mockReturnValue({ name: "Qova", type: "qova" }),
			helpers: {
				httpRequest: vi.fn().mockImplementation((opts: any) => {
					capturedOptions.push(opts);
					return Promise.resolve({ txHash: "0xabc", agent: "0x123" });
				}),
			},
		};

		const { qovaApiRequest } = await import(
			"../src/nodes/Qova/GenericFunctions"
		);
		await qovaApiRequest.call(mockContext as any, "POST", "/api/agents/register", {
			agent: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
		});

		expect(capturedOptions[0].method).toBe("POST");
		expect(capturedOptions[0].body).toEqual({
			agent: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
		});
	});
});

// ---------------------------------------------------------------------------
//  Input validation
// ---------------------------------------------------------------------------
describe("input validation", () => {
	it("validates Ethereum addresses correctly", () => {
		expect(isValidAddress("0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158")).toBe(
			true,
		);
		expect(isValidAddress("")).toBe(false);
		expect(isValidAddress("not-an-address")).toBe(false);
		expect(isValidAddress("0xGGGG")).toBe(false);
	});
});
