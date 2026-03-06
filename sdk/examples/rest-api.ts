/**
 * @qova/core — REST API Client Example
 *
 * If you prefer HTTP over on-chain reads, or need to use Qova from
 * a language without viem support, use the REST API with an API key.
 *
 * Generate your API key at https://qova.cc/dashboard/settings/api-keys
 *
 * Run: QOVA_API_KEY=qova_xxxxx bun run examples/rest-api.ts
 */

const API_BASE = process.env.QOVA_API_URL ?? "https://api.qova.cc";
const API_KEY = process.env.QOVA_API_KEY;

if (!API_KEY) {
	console.error("Set QOVA_API_KEY environment variable");
	process.exit(1);
}

/** Typed fetch helper with API key auth */
async function qovaFetch<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${API_BASE}${path}`;
	const res = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
			...options.headers,
		},
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(`Qova API ${res.status}: ${JSON.stringify(body)}`);
	}

	return res.json() as Promise<T>;
}

// ── Read Operations ────────────────────────────────────────────────

async function main(): Promise<void> {
	const agent = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";

	// 1. Health check
	const health = await qovaFetch<{ status: string }>("/api/health");
	console.log("API Status:", health.status);

	// 2. Get agent score
	const score = await qovaFetch<{
		agent: string;
		score: number;
		grade: string;
		gradeColor: string;
	}>(`/api/agents/${agent}/score`);
	console.log(`\nAgent: ${score.agent}`);
	console.log(`Score: ${score.score} (${score.grade})`);

	// 3. Full score breakdown
	const breakdown = await qovaFetch<{
		agent: string;
		score: number;
		grade: string;
		factors: Record<string, { raw: string; normalized: number; weight: number; contribution: number }>;
	}>(`/api/scores/${agent}`);
	console.log("\nScore Breakdown:");
	for (const [factor, data] of Object.entries(breakdown.factors)) {
		console.log(`  ${factor}: ${data.raw} (contribution: ${data.contribution})`);
	}

	// 4. Get agent details
	const details = await qovaFetch<Record<string, unknown>>(`/api/agents/${agent}`);
	console.log("\nAgent Details:", JSON.stringify(details, null, 2));

	// 5. Budget status
	const budget = await qovaFetch<Record<string, unknown>>(`/api/budgets/${agent}`);
	console.log("\nBudget Status:", JSON.stringify(budget, null, 2));

	// 6. Verify an agent (pre-transaction trust check)
	const verification = await qovaFetch<Record<string, unknown>>("/api/verify", {
		method: "POST",
		body: JSON.stringify({ agent }),
	});
	console.log("\nVerification:", JSON.stringify(verification, null, 2));

	// 7. Compute a score from raw metrics (stateless, no on-chain read)
	const computed = await qovaFetch<{ score: number; grade: string }>("/api/scores/compute", {
		method: "POST",
		body: JSON.stringify({
			totalVolume: "5000000000000000000",
			transactionCount: 150,
			successRate: 9800,
			dailySpent: "100000000000000000",
			dailyLimit: "1000000000000000000",
			accountAgeSeconds: 2592000,
			sanctionsClean: true,
		}),
	});
	console.log(`\nComputed Score: ${computed.score} (${computed.grade})`);
}

main().catch(console.error);
