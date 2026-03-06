import { describe, expect, it, vi } from "vitest";
import { AUTH_HEADERS } from "../helpers.js";

vi.mock("../../src/services/chain", () => ({
	getQovaClient: () => ({
		publicClient: {
			getCode: vi.fn().mockResolvedValue("0x6080"),
			getBlockNumber: vi.fn().mockResolvedValue(12345678n),
		},
	}),
}));

const { app } = await import("../../src/app.js");

describe("GET /api/health", () => {
	it("returns health status with contract info", async () => {
		const res = await app.request("/api/health", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("ok");
		expect(body.chain).toBe("base-sepolia");
		expect(body.chainId).toBe(84532);
		expect(body.contracts).toBeDefined();
		expect(body.circuits).toBeDefined();
		expect(body.sdk.version).toBe("0.2.0");
		expect(body.api.version).toBe("0.2.0");
	});
});

describe("GET /api/health/ready", () => {
	it("returns ready when chain is reachable", async () => {
		const res = await app.request("/api/health/ready");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ready).toBe(true);
	});
});

describe("GET /api/health/live", () => {
	it("returns alive", async () => {
		const res = await app.request("/api/health/live");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.alive).toBe(true);
	});
});

describe("GET /", () => {
	it("returns API info", async () => {
		const res = await app.request("/", { headers: AUTH_HEADERS });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.name).toBe("Qova Protocol API");
	});
});
