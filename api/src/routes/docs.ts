/**
 * OpenAPI 3.1 specification for the Qova Protocol API.
 *
 * Serves auto-generated docs at /api/docs (JSON) and /api/docs/ui (Scalar UI).
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";

const OPENAPI_SPEC = {
	openapi: "3.1.0",
	info: {
		title: "Qova Protocol API",
		version: "0.1.0",
		description:
			"Financial trust infrastructure for AI agents. Query reputation scores, manage budgets, record transactions, and verify agent trustworthiness on Base L2.",
		contact: { name: "Qova Engineering", email: "eng@qova.cc", url: "https://qova.cc" },
		license: { name: "MIT" },
	},
	servers: [
		{ url: "https://api.qova.cc", description: "Production" },
		{ url: "http://localhost:3001", description: "Local Development" },
	],
	security: [{ bearerAuth: [] }],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				description:
					"API key generated from the Qova dashboard. Format: `qova_<40 characters>`",
			},
		},
		schemas: {
			EthAddress: {
				type: "string",
				pattern: "^0x[a-fA-F0-9]{40}$",
				example: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
			},
			HexString: {
				type: "string",
				pattern: "^0x[a-fA-F0-9]*$",
				example: "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
			ScoreGrade: {
				type: "string",
				enum: ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"],
			},
			TransactionType: {
				type: "integer",
				enum: [0, 1, 2, 3, 4],
				description: "0=Payment, 1=Swap, 2=Transfer, 3=ContractCall, 4=Bridge",
			},
			AgentScore: {
				type: "object",
				properties: {
					agent: { $ref: "#/components/schemas/EthAddress" },
					score: { type: "integer", minimum: 0, maximum: 1000 },
					grade: { $ref: "#/components/schemas/ScoreGrade" },
					gradeColor: { type: "string", example: "#22C55E" },
					scoreFormatted: { type: "string", example: "0847" },
					scorePercentage: { type: "number", example: 84.7 },
				},
			},
			AgentDetails: {
				type: "object",
				properties: {
					agent: { $ref: "#/components/schemas/EthAddress" },
					score: { type: "integer" },
					grade: { $ref: "#/components/schemas/ScoreGrade" },
					gradeColor: { type: "string" },
					scoreFormatted: { type: "string" },
					scorePercentage: { type: "number" },
					lastUpdated: { type: "string" },
					updateCount: { type: "integer" },
					isRegistered: { type: "boolean" },
					addressShort: { type: "string", example: "0x0a3A...1158" },
					explorerUrl: { type: "string" },
				},
			},
			ScoreBreakdown: {
				type: "object",
				properties: {
					agent: { $ref: "#/components/schemas/EthAddress" },
					score: { type: "integer" },
					grade: { $ref: "#/components/schemas/ScoreGrade" },
					gradeColor: { type: "string" },
					factors: {
						type: "object",
						properties: {
							transactionVolume: { $ref: "#/components/schemas/FactorDetail" },
							transactionCount: { $ref: "#/components/schemas/FactorDetail" },
							successRate: { $ref: "#/components/schemas/FactorDetail" },
							budgetCompliance: { $ref: "#/components/schemas/FactorDetail" },
							accountAge: { $ref: "#/components/schemas/FactorDetail" },
						},
					},
					timestamp: { type: "string", format: "date-time" },
				},
			},
			FactorDetail: {
				type: "object",
				properties: {
					raw: { type: "string" },
					normalized: { type: "number", minimum: 0, maximum: 1 },
					weight: { type: "number" },
					contribution: { type: "integer" },
				},
			},
			BudgetStatus: {
				type: "object",
				properties: {
					agent: { $ref: "#/components/schemas/EthAddress" },
					dailyRemaining: { type: "string" },
					monthlyRemaining: { type: "string" },
					perTxLimit: { type: "string" },
					dailySpent: { type: "string" },
					monthlySpent: { type: "string" },
				},
			},
			TransactionStats: {
				type: "object",
				properties: {
					agent: { $ref: "#/components/schemas/EthAddress" },
					totalCount: { type: "integer" },
					totalVolume: { type: "string" },
					successCount: { type: "integer" },
					lastActivityTimestamp: { type: "string" },
				},
			},
			ApiError: {
				type: "object",
				properties: {
					error: { type: "string" },
					code: { type: "string" },
					details: {},
				},
				required: ["error"],
			},
			TxHashResponse: {
				type: "object",
				properties: {
					txHash: { $ref: "#/components/schemas/HexString" },
				},
			},
		},
	},
	paths: {
		"/api/health": {
			get: {
				tags: ["System"],
				summary: "Health check",
				security: [],
				responses: {
					"200": {
						description: "API is healthy",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string", example: "ok" },
										chain: { type: "string", example: "base-sepolia" },
										timestamp: { type: "string", format: "date-time" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/agents": {
			get: {
				tags: ["Agents"],
				summary: "List registered agents",
				responses: {
					"200": {
						description: "List of agent addresses",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										agents: { type: "array", items: { $ref: "#/components/schemas/EthAddress" } },
										total: { type: "integer" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/agents/{address}": {
			get: {
				tags: ["Agents"],
				summary: "Get agent details",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				responses: {
					"200": {
						description: "Agent details with enriched score data",
						content: { "application/json": { schema: { $ref: "#/components/schemas/AgentDetails" } } },
					},
					"400": {
						description: "Invalid address",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
					},
				},
			},
		},
		"/api/agents/{address}/score": {
			get: {
				tags: ["Agents"],
				summary: "Get agent score",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				responses: {
					"200": {
						description: "Current score with grade",
						content: { "application/json": { schema: { $ref: "#/components/schemas/AgentScore" } } },
					},
				},
			},
			post: {
				tags: ["Agents"],
				summary: "Update agent score",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["score"],
								properties: {
									score: { type: "integer", minimum: 0, maximum: 1000 },
									reason: { $ref: "#/components/schemas/HexString" },
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Score updated",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										txHash: { $ref: "#/components/schemas/HexString" },
										agent: { $ref: "#/components/schemas/EthAddress" },
										newScore: { type: "integer" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/agents/{address}/registered": {
			get: {
				tags: ["Agents"],
				summary: "Check agent registration status",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				responses: {
					"200": {
						description: "Registration status",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										agent: { $ref: "#/components/schemas/EthAddress" },
										isRegistered: { type: "boolean" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/agents/register": {
			post: {
				tags: ["Agents"],
				summary: "Register a new agent",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["agent"],
								properties: { agent: { $ref: "#/components/schemas/EthAddress" } },
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Agent registered",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										txHash: { $ref: "#/components/schemas/HexString" },
										agent: { $ref: "#/components/schemas/EthAddress" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/agents/batch-scores": {
			post: {
				tags: ["Agents"],
				summary: "Batch update scores for multiple agents",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["agents", "scores", "reasons"],
								properties: {
									agents: { type: "array", items: { $ref: "#/components/schemas/EthAddress" }, maxItems: 50 },
									scores: { type: "array", items: { type: "integer", minimum: 0, maximum: 1000 } },
									reasons: { type: "array", items: { $ref: "#/components/schemas/HexString" } },
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Scores updated",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										txHash: { $ref: "#/components/schemas/HexString" },
										count: { type: "integer" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/scores/{address}": {
			get: {
				tags: ["Scores"],
				summary: "Full score breakdown with per-factor contributions",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				responses: {
					"200": {
						description: "Score breakdown",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ScoreBreakdown" } } },
					},
				},
			},
		},
		"/api/scores/compute": {
			post: {
				tags: ["Scores"],
				summary: "Compute score from raw metrics (stateless, no on-chain read)",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["totalVolume", "transactionCount", "successRate", "dailySpent", "dailyLimit", "accountAgeSeconds"],
								properties: {
									totalVolume: { type: "string", description: "Total volume in wei" },
									transactionCount: { type: "integer" },
									successRate: { type: "integer", minimum: 0, maximum: 10000, description: "Basis points (9500 = 95%)" },
									dailySpent: { type: "string" },
									dailyLimit: { type: "string" },
									accountAgeSeconds: { type: "integer" },
									sanctionsClean: { type: "boolean", default: true },
									apiReputationScore: { type: "number", minimum: 0, maximum: 100 },
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Computed score",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										score: { type: "integer" },
										grade: { $ref: "#/components/schemas/ScoreGrade" },
										gradeColor: { type: "string" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/transactions/{address}": {
			get: {
				tags: ["Transactions"],
				summary: "Get transaction stats for an agent",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				responses: {
					"200": {
						description: "Transaction statistics",
						content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionStats" } } },
					},
				},
			},
		},
		"/api/transactions/record": {
			post: {
				tags: ["Transactions"],
				summary: "Record a transaction for an agent",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["agent", "txHash", "amount", "txType"],
								properties: {
									agent: { $ref: "#/components/schemas/EthAddress" },
									txHash: { $ref: "#/components/schemas/HexString" },
									amount: { type: "string", description: "Amount in wei" },
									txType: { $ref: "#/components/schemas/TransactionType" },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Transaction recorded", content: { "application/json": { schema: { $ref: "#/components/schemas/TxHashResponse" } } } },
				},
			},
		},
		"/api/budgets/{address}": {
			get: {
				tags: ["Budgets"],
				summary: "Get budget status for an agent",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				responses: {
					"200": {
						description: "Budget status with remaining allowances",
						content: { "application/json": { schema: { $ref: "#/components/schemas/BudgetStatus" } } },
					},
				},
			},
		},
		"/api/budgets/{address}/set": {
			post: {
				tags: ["Budgets"],
				summary: "Set budget limits for an agent",
				parameters: [
					{ name: "address", in: "path", required: true, schema: { $ref: "#/components/schemas/EthAddress" } },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["dailyLimit", "monthlyLimit", "perTxLimit"],
								properties: {
									dailyLimit: { type: "string", description: "Daily limit in wei" },
									monthlyLimit: { type: "string", description: "Monthly limit in wei" },
									perTxLimit: { type: "string", description: "Per-transaction limit in wei" },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Budget set", content: { "application/json": { schema: { $ref: "#/components/schemas/TxHashResponse" } } } },
				},
			},
		},
		"/api/verify": {
			post: {
				tags: ["Verification"],
				summary: "Pre-transaction trust verification for an agent",
				description: "Check if an agent is registered, has a valid score, and is within budget before executing a transaction.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["agent"],
								properties: { agent: { $ref: "#/components/schemas/EthAddress" } },
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Verification result",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										agent: { $ref: "#/components/schemas/EthAddress" },
										verified: { type: "boolean" },
										score: { type: "integer" },
										grade: { $ref: "#/components/schemas/ScoreGrade" },
									},
								},
							},
						},
					},
				},
			},
		},
	},
	tags: [
		{ name: "Agents", description: "Agent registration, scores, and details" },
		{ name: "Scores", description: "Score computation and breakdowns" },
		{ name: "Transactions", description: "Transaction recording and stats" },
		{ name: "Budgets", description: "Budget management and enforcement" },
		{ name: "Verification", description: "Pre-transaction trust checks" },
		{ name: "System", description: "Health checks and system info" },
	],
} as const;

export const docsRoutes = new Hono();

/** GET /api/docs — OpenAPI 3.1 JSON spec */
docsRoutes.get("/", (c) => {
	return c.json(OPENAPI_SPEC);
});

/** GET /api/docs/ui — Scalar API reference UI */
docsRoutes.get("/ui", (c) => {
	const html = `<!doctype html>
<html>
<head>
  <title>Qova API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text x='4' y='26' font-size='28'>🛡️</text></svg>" />
</head>
<body>
  <script id="api-reference" data-url="/api/docs" data-configuration='${JSON.stringify({
		theme: "kepler",
		layout: "modern",
		darkMode: true,
		hideModels: false,
		hideDownloadButton: false,
		metaData: {
			title: "Qova Protocol API",
			description: "Financial trust infrastructure for AI agents",
		},
	})}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
	return c.html(html);
});

export { OPENAPI_SPEC };
