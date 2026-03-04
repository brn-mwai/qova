#!/usr/bin/env node
/**
 * Qova CLI — developer tool for interacting with the Qova API.
 *
 * Usage:
 *   qova score 0xAGENT
 *   qova verify 0xAGENT
 *   qova health
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import { Qova } from "../http/client.js";

const VERSION = "0.1.0";

function getApiKey(args: string[]): string {
	const keyIdx = args.indexOf("--key");
	if (keyIdx !== -1 && args[keyIdx + 1]) return args[keyIdx + 1]!;
	const envKey = process.env.QOVA_API_KEY;
	if (envKey) return envKey;
	console.error("Error: No API key. Set QOVA_API_KEY or use --key <key>");
	process.exit(1);
}

function getBaseUrl(): string {
	return process.env.QOVA_API_URL || "https://api.qova.cc";
}

function printJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

function usage(): void {
	const text = [
		"",
		"qova v" + VERSION + " — Qova Protocol CLI",
		"",
		"USAGE:",
		"  qova <command> [arguments] [--key <api_key>]",
		"",
		"COMMANDS:",
		"  score <address>          Get agent reputation score",
		"  verify <address>         Pre-transaction trust check",
		"  agent <address>          Get full agent details",
		"  budget <address>         Get budget status",
		"  stats <address>          Get transaction statistics",
		"  breakdown <address>      Full score breakdown with factors",
		"  health                   API health check",
		"  keys list                List your API keys",
		"  keys create              Create a new API key",
		"  keys revoke <id>         Revoke an API key",
		"",
		"ENVIRONMENT:",
		"  QOVA_API_KEY             Your API key (or use --key)",
		"  QOVA_API_URL             API base URL (default: https://api.qova.cc)",
		"",
	];
	console.log(text.join("\n"));
}

async function cmdScore(qova: Qova, address: string): Promise<void> {
	const r = await qova.agents.score(address);
	console.log("Agent:  " + r.agent);
	console.log("Score:  " + r.score + "/1000 (" + r.grade + ")");
	console.log("Color:  " + r.gradeColor);
}

async function cmdVerify(qova: Qova, address: string): Promise<void> {
	const r = await qova.verify(address);
	const icon = r.verified ? "\u2705" : "\u274C";
	console.log(icon + " Agent: " + r.agent);
	console.log("   Verified:    " + r.verified);
	console.log("   Registered:  " + r.isRegistered);
	console.log("   Score:       " + r.score + " (" + r.grade + ")");
	console.log("   Sanctions:   " + (r.sanctionsClean ? "Clean" : "FLAGGED"));
}

async function cmdAgent(qova: Qova, address: string): Promise<void> {
	printJson(await qova.agents.get(address));
}

async function cmdBudget(qova: Qova, address: string): Promise<void> {
	printJson(await qova.budgets.get(address));
}

async function cmdStats(qova: Qova, address: string): Promise<void> {
	printJson(await qova.transactions.stats(address));
}

async function cmdBreakdown(qova: Qova, address: string): Promise<void> {
	const r = await qova.scores.breakdown(address);
	console.log("Agent: " + r.agent);
	console.log("Score: " + r.score + " (" + r.grade + ")\n");
	console.log("Factors:");
	for (const [name, detail] of Object.entries(r.factors)) {
		const clamped = Math.max(0, Math.min(1, detail.normalized));
		const filled = "\u2588".repeat(Math.round(clamped * 20));
		const empty = "\u2591".repeat(20 - Math.round(clamped * 20));
		console.log("  " + name.padEnd(20) + " " + filled + empty + " " + detail.contribution + " (" + detail.raw + ")");
	}
}

async function cmdHealth(qova: Qova): Promise<void> {
	const r = await qova.health();
	console.log("Status: " + r.status);
	console.log("Chain:  " + r.chain + " (" + r.chainId + ")");
	console.log("API:    v" + r.api.version);
	console.log("SDK:    v" + r.sdk.version);
	if (r.contracts) {
		console.log("\nContracts:");
		for (const [name, info] of Object.entries(r.contracts)) {
			const icon = info.accessible ? "\u2705" : "\u274C";
			console.log("  " + icon + " " + name + ": " + info.address);
		}
	}
}

async function cmdKeysList(qova: Qova): Promise<void> {
	const r = await qova.keys.list();
	if (!r.keys.length) { console.log("No API keys found."); return; }
	for (const key of r.keys) {
		const s = key.isActive ? "\u2705" : "\u274C";
		console.log(s + " " + key.keyPrefix + "... \u2014 " + key.name + " [" + key.scopes.join(", ") + "]");
	}
}

async function cmdKeysCreate(qova: Qova, args: string[]): Promise<void> {
	const nameIdx = args.indexOf("--name");
	const scopesIdx = args.indexOf("--scopes");
	const name: string = (nameIdx !== -1 && args[nameIdx + 1]) ? args[nameIdx + 1]! : "CLI Key";
	const scopesStr: string = (scopesIdx !== -1 && args[scopesIdx + 1]) ? args[scopesIdx + 1]! : "agents:read,scores:read";
	const r = await qova.keys.create({ name, scopes: scopesStr.split(",") });
	console.log("\u26A0\uFE0F  Store this key securely \u2014 it will not be shown again!\n");
	console.log("Key:     " + r.key);
	console.log("Name:    " + r.name);
	console.log("Scopes:  " + r.scopes.join(", "));
	if (r.expiresAt) console.log("Expires: " + r.expiresAt);
}

async function cmdKeysRevoke(qova: Qova, id: string): Promise<void> {
	const r = await qova.keys.revoke(id);
	console.log(r.revoked ? "Key " + id + " revoked." : "Failed to revoke key " + id + ".");
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === "--help" || command === "-h") { usage(); return; }
	if (command === "--version" || command === "-v") { console.log("qova v" + VERSION); return; }

	const apiKey = getApiKey(args);
	const qova = new Qova(apiKey, { baseUrl: getBaseUrl() });

	try {
		switch (command) {
			case "score":
				if (!args[1]) { console.error("Usage: qova score <address>"); process.exit(1); }
				await cmdScore(qova, args[1]);
				break;
			case "verify":
				if (!args[1]) { console.error("Usage: qova verify <address>"); process.exit(1); }
				await cmdVerify(qova, args[1]);
				break;
			case "agent":
				if (!args[1]) { console.error("Usage: qova agent <address>"); process.exit(1); }
				await cmdAgent(qova, args[1]);
				break;
			case "budget":
				if (!args[1]) { console.error("Usage: qova budget <address>"); process.exit(1); }
				await cmdBudget(qova, args[1]);
				break;
			case "stats":
				if (!args[1]) { console.error("Usage: qova stats <address>"); process.exit(1); }
				await cmdStats(qova, args[1]);
				break;
			case "breakdown":
				if (!args[1]) { console.error("Usage: qova breakdown <address>"); process.exit(1); }
				await cmdBreakdown(qova, args[1]);
				break;
			case "health": await cmdHealth(qova); break;
			case "keys":
				if (args[1] === "list") await cmdKeysList(qova);
				else if (args[1] === "create") await cmdKeysCreate(qova, args);
				else if (args[1] === "revoke" && args[2]) await cmdKeysRevoke(qova, args[2]);
				else { console.error("Usage: qova keys [list|create|revoke]"); process.exit(1); }
				break;
			default:
				console.error("Unknown command: " + command);
				usage();
				process.exit(1);
		}
	} catch (error) {
		console.error("Error: " + (error instanceof Error ? error.message : "Unknown error"));
		process.exit(1);
	}
}

main();
