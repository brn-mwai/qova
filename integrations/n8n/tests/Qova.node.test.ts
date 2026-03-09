/**
 * Tests for the Qova n8n community node.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, it, expect } from "vitest";
import { isValidAddress } from "../src/nodes/Qova/GenericFunctions";

// ---------------------------------------------------------------------------
//  Address validation
// ---------------------------------------------------------------------------
describe("isValidAddress", () => {
	it("accepts a valid checksummed Ethereum address", () => {
		expect(isValidAddress("0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158")).toBe(true);
	});

	it("accepts a valid lowercase Ethereum address", () => {
		expect(isValidAddress("0x0000000000000000000000000000000000000001")).toBe(true);
	});

	it("rejects an address without 0x prefix", () => {
		expect(isValidAddress("0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158")).toBe(false);
	});

	it("rejects an address that is too short", () => {
		expect(isValidAddress("0x0a3AF9a104")).toBe(false);
	});

	it("rejects an address that is too long", () => {
		expect(isValidAddress("0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158FF")).toBe(false);
	});

	it("rejects an empty string", () => {
		expect(isValidAddress("")).toBe(false);
	});

	it("rejects non-hex characters", () => {
		expect(isValidAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
//  Node class structure
// ---------------------------------------------------------------------------
describe("Qova node class", () => {
	it("exports a class with the correct name", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		expect(node.description.name).toBe("qova");
		expect(node.description.displayName).toBe("Qova");
	});

	it("declares all four resources", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		const resourceProp = node.description.properties.find(
			(p) => p.name === "resource",
		);
		expect(resourceProp).toBeDefined();
		const resourceOptions = (resourceProp as { options: { value: string }[] }).options;
		const values = resourceOptions.map((o) => o.value);
		expect(values).toContain("agent");
		expect(values).toContain("score");
		expect(values).toContain("transaction");
		expect(values).toContain("budget");
	});

	it("requires qovaApi credentials", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		expect(node.description.credentials).toEqual([
			{ name: "qovaApi", required: true },
		]);
	});

	it("has a valid version number", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		expect(node.description.version).toBe(1);
	});

	it("lists main as input and output", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		expect(node.description.inputs).toEqual(["main"]);
		expect(node.description.outputs).toEqual(["main"]);
	});
});

// ---------------------------------------------------------------------------
//  Trigger node class structure
// ---------------------------------------------------------------------------
describe("QovaTrigger node class", () => {
	it("exports a class with the correct name", async () => {
		const { QovaTrigger } = await import("../src/nodes/Qova/QovaTrigger.node");
		const node = new QovaTrigger();
		expect(node.description.name).toBe("qovaTrigger");
		expect(node.description.displayName).toBe("Qova Trigger");
	});

	it("uses polling mode", async () => {
		const { QovaTrigger } = await import("../src/nodes/Qova/QovaTrigger.node");
		const node = new QovaTrigger();
		expect(node.description.polling).toBe(true);
	});

	it("has no inputs and main output", async () => {
		const { QovaTrigger } = await import("../src/nodes/Qova/QovaTrigger.node");
		const node = new QovaTrigger();
		expect(node.description.inputs).toEqual([]);
		expect(node.description.outputs).toEqual(["main"]);
	});

	it("supports five trigger conditions", async () => {
		const { QovaTrigger } = await import("../src/nodes/Qova/QovaTrigger.node");
		const node = new QovaTrigger();
		const triggerProp = node.description.properties.find(
			(p) => p.name === "triggerOn",
		);
		expect(triggerProp).toBeDefined();
		const options = (triggerProp as { options: { value: string }[] }).options;
		const values = options.map((o) => o.value);
		expect(values).toEqual([
			"anyChange",
			"threshold",
			"gradeChange",
			"scoreBelow",
			"scoreAbove",
		]);
	});
});

// ---------------------------------------------------------------------------
//  Credentials class structure
// ---------------------------------------------------------------------------
describe("QovaApi credentials class", () => {
	it("exports a class with the correct name", async () => {
		const { QovaApi } = await import("../src/credentials/QovaApi.credentials");
		const creds = new QovaApi();
		expect(creds.name).toBe("qovaApi");
		expect(creds.displayName).toBe("Qova API");
	});

	it("has apiKey and baseUrl fields", async () => {
		const { QovaApi } = await import("../src/credentials/QovaApi.credentials");
		const creds = new QovaApi();
		const fieldNames = creds.properties.map((p) => p.name);
		expect(fieldNames).toContain("apiKey");
		expect(fieldNames).toContain("baseUrl");
	});

	it("marks apiKey as password type", async () => {
		const { QovaApi } = await import("../src/credentials/QovaApi.credentials");
		const creds = new QovaApi();
		const apiKeyField = creds.properties.find((p) => p.name === "apiKey");
		expect(apiKeyField?.typeOptions).toEqual({ password: true });
	});

	it("defaults baseUrl to the production API", async () => {
		const { QovaApi } = await import("../src/credentials/QovaApi.credentials");
		const creds = new QovaApi();
		const baseUrlField = creds.properties.find((p) => p.name === "baseUrl");
		expect(baseUrlField?.default).toBe("https://api.qova.cc");
	});

	it("uses x-api-key header for authentication", async () => {
		const { QovaApi } = await import("../src/credentials/QovaApi.credentials");
		const creds = new QovaApi();
		expect(creds.authenticate).toEqual({
			type: "generic",
			properties: {
				headers: {
					"x-api-key": "={{$credentials.apiKey}}",
				},
			},
		});
	});

	it("tests credentials against the health endpoint", async () => {
		const { QovaApi } = await import("../src/credentials/QovaApi.credentials");
		const creds = new QovaApi();
		expect(creds.test).toEqual({
			request: {
				baseURL: "={{$credentials.baseUrl}}",
				url: "/api/health",
				method: "GET",
			},
		});
	});
});

// ---------------------------------------------------------------------------
//  Node operation coverage
// ---------------------------------------------------------------------------
describe("Qova node operation completeness", () => {
	it("has all agent operations mapped to correct API endpoints", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		const operationProps = node.description.properties.filter(
			(p) => p.name === "operation",
		);
		const agentOps = operationProps.find(
			(p) =>
				p.displayOptions?.show?.resource !== undefined &&
				(p.displayOptions.show.resource as string[]).includes("agent"),
		);
		expect(agentOps).toBeDefined();
		const agentValues = (agentOps as { options: { value: string }[] }).options.map(
			(o) => o.value,
		);
		expect(agentValues).toContain("getDetails");
		expect(agentValues).toContain("getScore");
		expect(agentValues).toContain("checkRegistration");
		expect(agentValues).toContain("register");
		expect(agentValues).toContain("updateScore");
	});

	it("has all score operations", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		const operationProps = node.description.properties.filter(
			(p) => p.name === "operation",
		);
		const scoreOps = operationProps.find(
			(p) =>
				p.displayOptions?.show?.resource !== undefined &&
				(p.displayOptions.show.resource as string[]).includes("score"),
		);
		expect(scoreOps).toBeDefined();
		const scoreValues = (scoreOps as { options: { value: string }[] }).options.map(
			(o) => o.value,
		);
		expect(scoreValues).toContain("getBreakdown");
		expect(scoreValues).toContain("compute");
	});

	it("has all budget operations", async () => {
		const { Qova } = await import("../src/nodes/Qova/Qova.node");
		const node = new Qova();
		const operationProps = node.description.properties.filter(
			(p) => p.name === "operation",
		);
		const budgetOps = operationProps.find(
			(p) =>
				p.displayOptions?.show?.resource !== undefined &&
				(p.displayOptions.show.resource as string[]).includes("budget"),
		);
		expect(budgetOps).toBeDefined();
		const budgetValues = (budgetOps as { options: { value: string }[] }).options.map(
			(o) => o.value,
		);
		expect(budgetValues).toContain("getStatus");
		expect(budgetValues).toContain("setLimits");
		expect(budgetValues).toContain("check");
	});
});
