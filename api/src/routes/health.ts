/**
 * Health check + readiness probe endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

import { CHAIN_IDS, CONTRACTS } from "@qova/core";
import { Hono } from "hono";
import { getQovaClient } from "../services/chain.js";
import { getAllCircuitStates } from "../middleware/circuit-breaker.js";

export const healthRoutes = new Hono();

/** GET /api/health -- Full health check: contracts + circuits */
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
	const circuits = getAllCircuitStates();
	const anyOpen = Object.values(circuits).some((s) => s === "OPEN");

	const status = allAccessible && !anyOpen ? "ok" : "degraded";

	return c.json({
		status,
		timestamp: new Date().toISOString(),
		chain: "base-sepolia",
		chainId: CHAIN_IDS.BASE_SEPOLIA,
		contracts: contractChecks,
		circuits,
		sdk: { version: "0.2.0" },
		api: { version: "0.2.0" },
	});
});

/**
 * GET /api/health/ready -- Kubernetes readiness probe.
 *
 * Returns 200 if the service can accept traffic (chain + Convex reachable).
 * Returns 503 if any critical dependency is unreachable.
 */
healthRoutes.get("/ready", async (c) => {
	const circuits = getAllCircuitStates();
	const anyOpen = Object.values(circuits).some((s) => s === "OPEN");

	if (anyOpen) {
		return c.json({
			ready: false,
			reason: "Circuit breaker open",
			circuits,
		}, 503);
	}

	// Quick chain connectivity check
	try {
		const client = getQovaClient();
		await client.publicClient.getBlockNumber();
	} catch {
		return c.json({
			ready: false,
			reason: "Chain RPC unreachable",
		}, 503);
	}

	return c.json({ ready: true });
});

/**
 * GET /api/health/live -- Kubernetes liveness probe.
 *
 * Returns 200 if the process is alive. Intentionally cheap.
 */
healthRoutes.get("/live", (c) => {
	return c.json({ alive: true });
});
