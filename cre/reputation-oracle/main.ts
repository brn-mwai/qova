/**
 * Reputation Oracle -- CRE Workflow (AI-Enhanced)
 *
 * Trigger: Cron (every 10 minutes)
 * Flow: Read 3 contracts -> AI behavioral analysis via Groq -> compute BigInt score -> write on-chain
 * Quota budget: 3 EVM reads (of 10 max), 1 HTTP call (AI), 1 EVM write
 *
 * AI Integration: Each DON node independently calls Groq (Llama 3.1 70B) to
 * analyze agent transaction patterns. Consensus via median aggregation on
 * numeric fields. AI contributes 15% of final score.
 */
import {
	Runner,
	handler,
	CronCapability,
	EVMClient,
	HTTPClient,
	getNetwork,
	encodeCallMsg,
	bytesToHex,
	hexToBase64,
	ConsensusAggregationByFields,
	median,
	ignore,
	LAST_FINALIZED_BLOCK_NUMBER,
	type Runtime,
	type NodeRuntime,
	type CronPayload,
} from "@chainlink/cre-sdk";
import {
	encodeFunctionData,
	decodeFunctionResult,
	encodeAbiParameters,
	parseAbiParameters,
	zeroAddress,
	type Address,
} from "viem";
import { z } from "zod";
import {
	REPUTATION_REGISTRY_ABI,
	TRANSACTION_VALIDATOR_ABI,
	BUDGET_ENFORCER_ABI,
} from "../shared/contracts";
import {
	type AgentMetrics as ScoringMetrics,
	computeReputationScore,
	MAX_SCORE,
	MIN_SCORE_CHANGE,
} from "../shared/scoring";

const configSchema = z.object({
	chainSelectorName: z.string(),
	reputationRegistryAddress: z.string(),
	transactionValidatorAddress: z.string(),
	budgetEnforcerAddress: z.string(),
	gasLimit: z.string(),
	schedule: z.string(),
	aiEnabled: z.boolean().default(true),
	agentAddress: z.string().optional(),
});
type Config = z.infer<typeof configSchema>;

// ── AI Response Validation Schemas ──

const AIResponseSchema = z.object({
	choices: z.array(z.object({
		message: z.object({
			content: z.string(),
		}),
	})).min(1),
});

const AIAnalysisSchema = z.object({
	risk_score: z.number().min(0).max(100),
	behavioral_flags: z.array(z.string()),
	confidence: z.number().min(0).max(100),
});

// ── AI Analysis Types ──

interface AIAnalysis {
	risk_score: number;
	behavioral_flags: string[];
	confidence: number;
}

interface AgentMetrics {
	txCount: string;
	successRate: string;
	totalVolume: string;
	budgetUtilization: string;
	accountAge: string;
	recentFailures: string;
}

// ── AI Behavioral Analysis ──

function buildAnalysisPrompt(metrics: AgentMetrics): string {
	return `You are a financial risk analyst for autonomous AI agents operating on blockchain.

Analyze this AI agent's on-chain transaction behavior and provide a risk assessment.

Agent Metrics:
- Total transactions: ${metrics.txCount}
- Success rate: ${metrics.successRate} basis points (10000 = 100%)
- Total volume (wei): ${metrics.totalVolume}
- Budget utilization: ${metrics.budgetUtilization} basis points (10000 = 100%)
- Account age (seconds): ${metrics.accountAge}
- Recent failures: ${metrics.recentFailures}

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "risk_score": <number 0-100 where 0 is safest>,
  "behavioral_flags": ["consistent_performer", "high_volume_trader", etc],
  "confidence": <number 0-100>
}`;
}

/**
 * Each DON node independently calls Groq API with Llama 3.1 70B.
 * Temperature 0 ensures deterministic responses for BFT consensus.
 */
const analyzeAgentBehavior = (
	nodeRuntime: NodeRuntime<Config>,
	metrics: AgentMetrics,
	apiKey: string,
): AIAnalysis => {
	const httpClient = new HTTPClient();

	const prompt = buildAnalysisPrompt(metrics);

	const response = httpClient
		.sendRequest(nodeRuntime, {
			url: "https://api.groq.com/openai/v1/chat/completions",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "llama-3.1-70b-versatile",
				temperature: 0,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			}),
		})
		.result();

	try {
		const groqResponse = JSON.parse(response.body);
		const parsed = AIResponseSchema.parse(groqResponse);
		const content = parsed.choices[0].message.content;
		const analysis = AIAnalysisSchema.parse(JSON.parse(content));
		return analysis;
	} catch (e) {
		throw new Error(`AI response validation failed: ${e instanceof Error ? e.message : String(e)}`);
	}
};

// ── Callback ──
const onCronTrigger = (
	runtime: Runtime<Config>,
	_payload: CronPayload,
): string => {
	const config = runtime.config;

	const network = getNetwork({
		chainFamily: "evm",
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	});
	if (!network)
		throw new Error(`Network not found: ${config.chainSelectorName}`);

	const evmClient = new EVMClient(network.chainSelector.selector);

	// Read agent address from config, fallback to deployer for hackathon demo
	const agentAddress = (config.agentAddress ??
		"0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158") as Address;

	runtime.log(`AI-enhanced scoring for agent: ${agentAddress}`);

	// ── EVM Read 1: Agent score from ReputationRegistry ──
	const scoreResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.reputationRegistryAddress as Address,
				data: encodeFunctionData({
					abi: REPUTATION_REGISTRY_ABI,
					functionName: "getScore",
					args: [agentAddress],
				}),
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const currentScore = BigInt(
		decodeFunctionResult({
			abi: REPUTATION_REGISTRY_ABI,
			functionName: "getScore",
			data: bytesToHex(scoreResult.data),
		}) as number,
	);

	// ── EVM Read 2: Transaction stats from TransactionValidator ──
	const statsResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.transactionValidatorAddress as Address,
				data: encodeFunctionData({
					abi: TRANSACTION_VALIDATOR_ABI,
					functionName: "getTransactionStats",
					args: [agentAddress],
				}),
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const rawStats = decodeFunctionResult({
		abi: TRANSACTION_VALIDATOR_ABI,
		functionName: "getTransactionStats",
		data: bytesToHex(statsResult.data),
	}) as unknown as Record<string, number | bigint>;
	const stats = {
		totalCount: BigInt(rawStats.totalCount ?? 0),
		totalVolume: BigInt(rawStats.totalVolume ?? 0),
		successCount: BigInt(rawStats.successCount ?? 0),
		lastActivityTimestamp: BigInt(rawStats.lastActivityTimestamp ?? 0),
	};

	// ── EVM Read 3: Budget status from BudgetEnforcer ──
	const budgetResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.budgetEnforcerAddress as Address,
				data: encodeFunctionData({
					abi: BUDGET_ENFORCER_ABI,
					functionName: "getBudgetStatus",
					args: [agentAddress],
				}),
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const rawBudget = decodeFunctionResult({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "getBudgetStatus",
		data: bytesToHex(budgetResult.data),
	}) as unknown as Record<string, number | bigint>;
	const budget = {
		dailyRemaining: BigInt(rawBudget.dailyRemaining ?? 0),
		monthlyRemaining: BigInt(rawBudget.monthlyRemaining ?? 0),
		perTxLimit: BigInt(rawBudget.perTxLimit ?? 0),
		dailySpent: BigInt(rawBudget.dailySpent ?? 0),
		monthlySpent: BigInt(rawBudget.monthlySpent ?? 0),
	};

	// ── EVM Read (bonus): Agent registration timestamp for true account age ──
	const detailsResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.reputationRegistryAddress as Address,
				data: encodeFunctionData({
					abi: REPUTATION_REGISTRY_ABI,
					functionName: "getAgentDetails",
					args: [agentAddress],
				}),
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const rawDetails = decodeFunctionResult({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "getAgentDetails",
		data: bytesToHex(detailsResult.data),
	}) as unknown as Record<string, number | bigint>;
	const registrationTimestamp = BigInt(rawDetails.lastUpdated ?? 0);

	// ── Compute derived metrics (all BigInt) ──
	const now = runtime.now();
	const nowSec = BigInt(Math.floor(now.getTime() / 1000));
	// Use registration timestamp if available, fall back to lastActivity
	const accountAgeSec =
		registrationTimestamp > 0n
			? nowSec - registrationTimestamp
			: stats.lastActivityTimestamp > 0n
				? nowSec - stats.lastActivityTimestamp
				: 0n;

	const dailyLimit = budget.dailyRemaining + budget.dailySpent;
	const monthlyLimit = budget.monthlyRemaining + budget.monthlySpent;
	const failureCount =
		stats.totalCount > stats.successCount
			? stats.totalCount - stats.successCount
			: 0n;

	// ── Traditional score (deterministic, 5-factor) ──
	const successRateBpsRaw =
		stats.totalCount > 0n
			? (stats.successCount * 10000n) / stats.totalCount
			: 0n;

	const scoringMetrics: ScoringMetrics = {
		totalVolume: stats.totalVolume,
		transactionCount: Number(stats.totalCount),
		successRate: Number(successRateBpsRaw),
		dailySpent: budget.dailySpent,
		dailyLimit: dailyLimit,
		accountAgeSeconds: Number(accountAgeSec),
		sanctionsClean: true,
	};

	const traditionalScore = computeReputationScore(scoringMetrics);

	runtime.log(
		`Agent ${agentAddress}: current=${currentScore}, traditional=${traditionalScore}`,
	);

	// ── AI-Enhanced Scoring ──
	let newScore = BigInt(traditionalScore);

	if (config.aiEnabled) {
		// Prepare metrics for AI analysis
		const successRateBps =
			stats.totalCount > 0n
				? (stats.successCount * 10000n) / stats.totalCount
				: 10000n;
		const budgetUtilBps =
			dailyLimit > 0n
				? (budget.dailySpent * 10000n) / dailyLimit
				: 0n;

		const metrics: AgentMetrics = {
			txCount: stats.totalCount.toString(),
			successRate: successRateBps.toString(),
			totalVolume: stats.totalVolume.toString(),
			budgetUtilization: budgetUtilBps.toString(),
			accountAge: accountAgeSec.toString(),
			recentFailures: failureCount.toString(),
		};

		try {
			// Get API key in DON mode (secrets only available on Runtime, not NodeRuntime)
			const apiKey = runtime
				.getSecret({ id: "AI_API_KEY" })
				.result().value;

			// Each DON node calls Groq independently, consensus via median on numerics
			const aiResult = runtime.runInNodeMode(
				analyzeAgentBehavior,
				ConsensusAggregationByFields<AIAnalysis>({
					risk_score: median(),
					behavioral_flags: ignore(),
					confidence: median(),
				}),
			)(metrics, apiKey).result();

			runtime.log(
				`AI analysis: risk=${aiResult.risk_score}, confidence=${aiResult.confidence}, flags=${JSON.stringify(aiResult.behavioral_flags)}`,
			);

			// Combine: traditional 85% + AI 15%
			// AI risk_score (0-100, higher = riskier) -> aiAdjustment (0-1000, higher = better)
			const aiAdjustment =
				(100n - BigInt(aiResult.risk_score)) * 10n;

			newScore =
				(BigInt(traditionalScore) * 8500n) / 10000n +
				(aiAdjustment * 1500n) / 10000n;

			// Clamp to [0, 1000]
			if (newScore > MAX_SCORE) newScore = MAX_SCORE;
			if (newScore < 0n) newScore = 0n;

			runtime.log(
				`Score breakdown: traditional=${traditionalScore}, aiAdjustment=${aiAdjustment}, final=${newScore}`,
			);
		} catch (e) {
			// Fallback: if AI fails, use 100% traditional score
			runtime.log(
				`AI analysis failed, using traditional score: ${e instanceof Error ? e.message : String(e)}`,
			);
			newScore = BigInt(traditionalScore);
		}
	}

	// ── Gas optimization: only write if score changed significantly ──
	const scoreDiff =
		newScore > currentScore
			? newScore - currentScore
			: currentScore - newScore;
	if (scoreDiff < BigInt(MIN_SCORE_CHANGE)) {
		runtime.log(
			`Score change ${scoreDiff} below threshold ${MIN_SCORE_CHANGE}, skipping write`,
		);
		return JSON.stringify({
			agent: agentAddress,
			score: newScore.toString(),
			skipped: true,
		});
	}

	// ── Write on-chain via CRE report ──
	const encoded = encodeAbiParameters(
		parseAbiParameters("address agent, uint256 score, uint256 timestamp"),
		[agentAddress, newScore, nowSec],
	);

	const report = runtime
		.report({
			encodedPayload: hexToBase64(encoded),
			encoderName: "evm",
			signingAlgo: "ecdsa",
			hashingAlgo: "keccak256",
		})
		.result();

	evmClient
		.writeReport(runtime, {
			receiver: config.reputationRegistryAddress,
			report,
			gasConfig: { gasLimit: config.gasLimit },
		})
		.result();

	runtime.log(`Score written on-chain: ${agentAddress} -> ${newScore}`);

	return JSON.stringify({
		agent: agentAddress,
		oldScore: currentScore.toString(),
		newScore: newScore.toString(),
		aiEnhanced: config.aiEnabled,
	});
};

// ── Init ──
const initWorkflow = (config: Config) => {
	const cron = new CronCapability();
	return [
		handler(
			cron.trigger({ schedule: config.schedule }),
			onCronTrigger,
		),
	];
};

// ── Entry point ──
export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema });
	await runner.run(initWorkflow);
}
