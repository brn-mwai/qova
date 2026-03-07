/**
 * Health check + system info endpoint.
 * @author Qova Engineering <eng@qova.cc>
 */

import { CHAIN_IDS, CONTRACTS } from "@brnmwai/qova-core";
import { Hono } from "hono";
import { getQovaClient } from "../services/chain.js";

export const healthRoutes = new Hono();

/** GET /api/health -- Server health + contract connectivity */
healthRoutes.get("/", async (c) => {
	const contracts = CONTRACTS[CHAIN_IDS.BASE_SEPOLIA];
	const client = getQovaClient();

	const contractChecks: Record<string, { address: string; accessible: boolean }> = {};

	const contractEntries = Object.entries(contracts ?? {}) as [string, string][];

	await Promise.all(
		contractEntries.map(async ([name, address]) => {
			try {
				const code = await client.publicClient.getCode({
					address: address as `0x${string}`,
				});
				contractChecks[name] = {
					address,
					accessible: !!code && code !== "0x",
				};
			} catch {
				contractChecks[name] = { address, accessible: false };
			}
		}),
	);

	const allAccessible = Object.values(contractChecks).every((c) => c.accessible);

	return c.json({
		status: allAccessible ? "ok" : "degraded",
		timestamp: new Date().toISOString(),
		chain: "base-sepolia",
		chainId: CHAIN_IDS.BASE_SEPOLIA,
		contracts: contractChecks,
		sdk: { version: "0.1.0" },
		api: { version: "0.1.0" },
	});
});
