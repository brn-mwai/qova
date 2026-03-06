import { describe, expect, it, vi } from "vitest";
import { AUTH_HEADERS, authedHeaders } from "../helpers.js";

vi.mock("../../src/services/chain", () => ({
	getQovaClient: () => ({
		isAgentRegistered: vi.fn().mockResolvedValue(true),
		getScore: vi.fn().mockResolvedValue(850),
	}),
}));

const { app } = await import("../../src/app.js");

const VALID_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("POST /api/verify", () => {
	it("verifies a registered agent", async () => {
		const res = await app.request("/api/verify", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: VALID_ADDRESS }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.verified).toBe(true);
		expect(body.score).toBe(850);
		expect(body.grade).toBe("A");
		expect(body.isRegistered).toBe(true);
		expect(body.sanctionsClean).toBe(true);
	});

	it("returns 400 for invalid agent address", async () => {
		const res = await app.request("/api/verify", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: "bad" }),
		});
		expect(res.status).toBe(400);
	});
});

describe("POST /api/verify/sanctions", () => {
	it("returns sanctions screening result", async () => {
		const res = await app.request("/api/verify/sanctions", {
			method: "POST",
			headers: authedHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ agent: VALID_ADDRESS }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.clean).toBe(true);
		expect(body.source).toBe("mock-ofac-sdn");
	});
});
