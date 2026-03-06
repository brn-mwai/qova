/**
 * Mock Qova API server — deterministic responses for SDK testing.
 *
 * Usage:
 *   import { createMockServer, type MockServerOptions } from "@qova/core/testing";
 *   const mock = createMockServer({ port: 9999 });
 *   await mock.start();
 *   const qova = new Qova("qova_test_key", { baseUrl: mock.url });
 *   // ... run tests ...
 *   await mock.stop();
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Server } from "node:http";

export interface MockServerOptions {
	port?: number;
}

export interface MockServer {
	url: string;
	start: () => Promise<void>;
	stop: () => Promise<void>;
}

/** Deterministic mock data. */
const MOCK_AGENTS = [
	{ address: "0x0000000000000000000000000000000000000001", score: 850, isRegistered: true },
	{ address: "0x0000000000000000000000000000000000000002", score: 420, isRegistered: false },
	{ address: "0x0000000000000000000000000000000000000003", score: 720, isRegistered: true },
];

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"X-Request-Id": crypto.randomUUID(),
		},
	});
}

function problemResponse(status: number, code: string, title: string, detail: string): Response {
	return new Response(
		JSON.stringify({ type: `https://api.qova.cc/errors/${code}`, title, status, detail, code }),
		{ status, headers: { "Content-Type": "application/problem+json" } },
	);
}

function handleRequest(req: Request): Response {
	const url = new URL(req.url);
	const path = url.pathname;
	const method = req.method;

	// Auth check
	const auth = req.headers.get("Authorization");
	if (path.startsWith("/api/") && path !== "/api/health" && path !== "/api/health/live" && path !== "/api/docs" && path !== "/api/metrics") {
		if (!auth || !auth.startsWith("Bearer qova_")) {
			return problemResponse(401, "UNAUTHORIZED", "Authentication Required", "Missing or invalid API key");
		}
	}

	// Health
	if (path === "/api/health" && method === "GET") {
		return jsonResponse({ status: "ok", timestamp: new Date().toISOString(), chain: "mock", chainId: 0 });
	}
	if (path === "/api/health/live") return jsonResponse({ alive: true });
	if (path === "/api/health/ready") return jsonResponse({ ready: true });

	// Agents
	if (path === "/api/agents" && method === "GET") {
		const limit = Number(url.searchParams.get("limit") || 20);
		const data = MOCK_AGENTS.slice(0, limit);
		return jsonResponse({
			data,
			pagination: { total: MOCK_AGENTS.length, limit, hasMore: false, nextCursor: null },
		});
	}

	const agentMatch = path.match(/^\/api\/agents\/(0x[a-fA-F0-9]{40})$/);
	if (agentMatch && method === "GET") {
		const agent = MOCK_AGENTS.find((a) => a.address.toLowerCase() === agentMatch[1]!.toLowerCase());
		if (!agent) return problemResponse(404, "AGENT_NOT_REGISTERED", "Not Found", "Agent not found");
		return jsonResponse({
			agent: agent.address, score: agent.score, grade: "A", gradeColor: "#22C55E",
			scoreFormatted: "0850", scorePercentage: 85, isRegistered: agent.isRegistered,
			lastUpdated: new Date().toISOString(), updateCount: 5, addressShort: `${agent.address.slice(0, 6)}...`,
			explorerUrl: `https://sepolia.basescan.org/address/${agent.address}`,
		});
	}

	const scoreMatch = path.match(/^\/api\/agents\/(0x[a-fA-F0-9]{40})\/score$/);
	if (scoreMatch && method === "GET") {
		const agent = MOCK_AGENTS.find((a) => a.address.toLowerCase() === scoreMatch[1]!.toLowerCase());
		if (!agent) return problemResponse(404, "AGENT_NOT_REGISTERED", "Not Found", "Agent not found");
		return jsonResponse({ agent: agent.address, score: agent.score, grade: "A", gradeColor: "#22C55E" });
	}

	if (path === "/api/agents/register" && method === "POST") {
		return jsonResponse({ txHash: "0xmock_tx_hash_" + Date.now(), agent: "0x0000000000000000000000000000000000000001" }, 201);
	}

	// Transactions
	if (path === "/api/transactions/record" && method === "POST") {
		return jsonResponse({ txHash: "0xmock_tx_" + Date.now() }, 201);
	}

	// Scores
	if (path === "/api/scores/compute" && method === "POST") {
		return jsonResponse({ score: 750, grade: "A", gradeColor: "#22C55E" });
	}

	// Verify
	if (path === "/api/verify" && method === "POST") {
		return jsonResponse({
			agent: "0x0000000000000000000000000000000000000001", verified: true, score: 850,
			grade: "A", sanctionsClean: true, isRegistered: true, timestamp: new Date().toISOString(),
		});
	}

	// Fallback
	return problemResponse(404, "NOT_FOUND", "Not Found", `No route matches ${method} ${path}`);
}

/**
 * Create a mock Qova API server.
 */
export function createMockServer(options: MockServerOptions = {}): MockServer {
	const port = options.port ?? 0; // 0 = auto-assign
	let server: Server | null = null;
	let resolvedPort = port;

	return {
		get url() {
			return `http://localhost:${resolvedPort}`;
		},
		async start() {
			const { createServer } = await import("node:http");
			return new Promise<void>((resolve) => {
				server = createServer(async (req, res) => {
					// Convert Node request to Web Request
					const url = `http://localhost:${resolvedPort}${req.url}`;
					const headers: Record<string, string> = {};
					for (const [key, val] of Object.entries(req.headers)) {
						if (typeof val === "string") headers[key] = val;
					}

					let body = "";
					for await (const chunk of req) body += chunk;

					const webReq = new Request(url, {
						method: req.method,
						headers,
						body: body || undefined,
					});

					const webRes = handleRequest(webReq);
					res.writeHead(webRes.status, Object.fromEntries(webRes.headers));
					res.end(await webRes.text());
				});

				server.listen(port, () => {
					const addr = server!.address();
					if (typeof addr === "object" && addr) resolvedPort = addr.port;
					resolve();
				});
			});
		},
		async stop() {
			return new Promise<void>((resolve) => {
				if (server) server.close(() => resolve());
				else resolve();
			});
		},
	};
}
