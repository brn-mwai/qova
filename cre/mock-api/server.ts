/**
 * @file mock-api/server.ts
 * Mock Qova Scoring API for CRE workflow simulation.
 * Run with: bun run cre/mock-api/server.ts
 */

const MOCK_AGENTS = [
	"0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
	"0x0000000000000000000000000000000000000001",
	"0x0000000000000000000000000000000000000002",
];

/** Simulated flagged contract addresses */
const FLAGGED_CONTRACTS = new Set([
	"0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
	"0xbad0000000000000000000000000000000000bad",
]);

const server = Bun.serve({
	port: 3001,
	async fetch(req: Request): Promise<Response> {
		const url = new URL(req.url);

		// ── Reputation Oracle Endpoints ──

		// GET /v1/agents -- registered agent addresses
		if (url.pathname === "/v1/agents" && req.method === "GET") {
			return Response.json({ agents: MOCK_AGENTS });
		}

		// POST /v1/enrich -- off-chain enrichment data
		if (url.pathname === "/v1/enrich" && req.method === "POST") {
			return Response.json({
				sanctionsClean: true,
				apiReputationScore: 82,
				riskLevel: "LOW",
				lastChecked: Date.now(),
			});
		}

		// ── Transaction Monitor Endpoints ──

		// POST /v1/anomaly-check -- anomaly detection
		if (url.pathname === "/v1/anomaly-check" && req.method === "POST") {
			const body = await parseBody(req);
			const targetContract = body?.targetContract as string | undefined;
			return Response.json({
				anomalyDetected: false,
				riskScore: 0.12,
				flags: [],
				interactedWithFlagged: targetContract
					? FLAGGED_CONTRACTS.has(targetContract.toLowerCase())
					: false,
			});
		}

		// POST /v1/tx-details -- fetch transaction details (simulates RPC enrichment)
		if (url.pathname === "/v1/tx-details" && req.method === "POST") {
			const body = await parseBody(req);
			return Response.json({
				agent: body?.agent ?? "0x0",
				recentTxCount: 15,
				avgValueWei: "1000000000000000000",
				failedTxCount: 1,
				contractsInteracted: [
					"0x1234567890abcdef1234567890abcdef12345678",
					"0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
				],
				flaggedContracts: [],
			});
		}

		// ── Budget Alert Endpoints ──

		// POST /v1/budget-context -- additional budget context
		if (url.pathname === "/v1/budget-context" && req.method === "POST") {
			return Response.json({
				historicalDailyAvg: "500000000000000000",
				historicalMonthlyAvg: "15000000000000000000",
				budgetAdjustmentSuggested: false,
			});
		}

		// ── Agent Verify Endpoints ──

		// POST /v1/sanctions/check -- sanctions screening
		if (url.pathname === "/v1/sanctions/check" && req.method === "POST") {
			return Response.json({
				clean: true,
				checked: true,
				source: "mock-ofac-sdn",
				timestamp: Date.now(),
			});
		}

		// POST /v1/contract-info -- contract metadata verification
		if (url.pathname === "/v1/contract-info" && req.method === "POST") {
			const body = await parseBody(req);
			const agent = body?.agent ?? "0x0";
			return Response.json({
				agent,
				contractExists: true,
				creationTimestamp: Math.floor(Date.now() / 1000) - 90 * 86400,
				creationTxHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
				ownerAddress: agent,
				ownerConsistent: true,
				recentOwnershipTransfer: false,
				lastOwnershipTransferTimestamp: 0,
				bytecodeHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				isProxy: false,
			});
		}

		// ── Shared Endpoints ──

		// POST /v1/webhook -- alert webhook sink
		if (url.pathname === "/v1/webhook" && req.method === "POST") {
			const body = await parseBody(req);
			console.log(`[WEBHOOK] Alert received at ${new Date().toISOString()}:`);
			console.log(`  Type: ${body?.type ?? "unknown"}`);
			console.log(`  Severity: ${body?.severity ?? "unknown"}`);
			console.log(`  Agent: ${body?.agent ?? "unknown"}`);
			return Response.json({ received: true });
		}

		return new Response("Not Found", { status: 404 });
	},
});

/** Parse JSON body from a request, returning null on failure. */
async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
	try {
		return (await req.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

console.log(`Mock Qova API running on http://localhost:${server.port}`);
