/**
 * Budget Alert -- CRE Workflow
 *
 * Trigger: EVM Log (SpendRecorded events on BudgetEnforcer)
 * Flow: Decode event -> read budget status -> compute utilization -> write report
 * Quota budget: 2 EVM reads, 1 EVM write
 */
import {
	Runner,
	handler,
	EVMClient,
	getNetwork,
	encodeCallMsg,
	bytesToHex,
	hexToBase64,
	logTriggerConfig,
	LAST_FINALIZED_BLOCK_NUMBER,
	type Runtime,
	type EVMLog,
} from "@chainlink/cre-sdk";
import {
	encodeFunctionData,
	decodeFunctionResult,
	encodeAbiParameters,
	parseAbiParameters,
	getAddress,
	zeroAddress,
	type Address,
} from "viem";
import { z } from "zod";
import {
	BUDGET_ENFORCER_ABI,
	REPUTATION_REGISTRY_ABI,
	EVENT_SIGNATURES,
} from "../shared/contracts";
import { withRetry } from "../shared/retry";

const configSchema = z.object({
	chainSelectorName: z.string(),
	reputationRegistryAddress: z.string(),
	budgetEnforcerAddress: z.string(),
	gasLimit: z.string(),
	thresholdYellow: z.number().default(7000),
	thresholdRed: z.number().default(9000),
	maxPenalty: z.number().default(25),
	minPenaltyIntervalSec: z.number().default(3600),
});
type Config = z.infer<typeof configSchema>;

function classifyAlert(bps: bigint, thresholdYellow: bigint, thresholdRed: bigint): "GREEN" | "YELLOW" | "RED" | "CRITICAL" {
	if (bps > 10000n) return "CRITICAL";
	if (bps > thresholdRed) return "RED";
	if (bps >= thresholdYellow) return "YELLOW";
	return "GREEN";
}

const onSpendRecorded = (runtime: Runtime<Config>, log: EVMLog): string => {
	const config = runtime.config;

	const rawTopic = bytesToHex(log.topics[1] ?? new Uint8Array());
	const agentAddress = getAddress(`0x${rawTopic.slice(-40)}`);
	runtime.log(`Spend recorded for agent: ${agentAddress}`);

	const network = getNetwork({
		chainFamily: "evm",
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	});
	if (!network)
		throw new Error(`Network not found: ${config.chainSelectorName}`);

	const evmClient = new EVMClient(network.chainSelector.selector);

	// EVM Read 1: Budget status
	let budget = { dailyRemaining: 0n, monthlyRemaining: 0n, dailySpent: 0n, monthlySpent: 0n };
	try {
		const budgetResult = withRetry(
			() =>
				evmClient
					.callContract(runtime, {
						call: encodeCallMsg({
							from: zeroAddress,
							to: config.budgetEnforcerAddress as Address,
							data: encodeFunctionData({
								abi: BUDGET_ENFORCER_ABI,
								functionName: "getBudgetStatus",
								args: [agentAddress as Address],
							}),
						}),
						blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
					})
					.result(),
			2,
			runtime,
		);

		const rawBudget = decodeFunctionResult({
			abi: BUDGET_ENFORCER_ABI,
			functionName: "getBudgetStatus",
			data: bytesToHex(budgetResult.data),
		}) as unknown as Record<string, number | bigint>;
		budget = {
			dailyRemaining: BigInt(rawBudget.dailyRemaining ?? 0),
			monthlyRemaining: BigInt(rawBudget.monthlyRemaining ?? 0),
			dailySpent: BigInt(rawBudget.dailySpent ?? 0),
			monthlySpent: BigInt(rawBudget.monthlySpent ?? 0),
		};
	} catch (e) {
		runtime.log(`Failed to read BudgetEnforcer.getBudgetStatus: ${e instanceof Error ? e.message : String(e)}`);
	}

	// EVM Read 2: Agent details (score + lastUpdated for penalty interval check)
	let currentScore = 0n;
	let lastUpdated = 0n;
	try {
		const detailsResult = withRetry(
			() =>
				evmClient
					.callContract(runtime, {
						call: encodeCallMsg({
							from: zeroAddress,
							to: config.reputationRegistryAddress as Address,
							data: encodeFunctionData({
								abi: REPUTATION_REGISTRY_ABI,
								functionName: "getAgentDetails",
								args: [agentAddress as Address],
							}),
						}),
						blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
					})
					.result(),
			2,
			runtime,
		);

		const rawDetails = decodeFunctionResult({
			abi: REPUTATION_REGISTRY_ABI,
			functionName: "getAgentDetails",
			data: bytesToHex(detailsResult.data),
		}) as unknown as Record<string, number | bigint>;
		currentScore = BigInt(rawDetails.score ?? 0);
		lastUpdated = BigInt(rawDetails.lastUpdated ?? 0);
	} catch (e) {
		runtime.log(`Failed to read ReputationRegistry.getAgentDetails: ${e instanceof Error ? e.message : String(e)}`);
	}

	// Compute utilization (all BigInt)
	const dailyLimit = budget.dailySpent + budget.dailyRemaining;
	const monthlyLimit = budget.monthlySpent + budget.monthlyRemaining;

	const dailyUtilBps =
		dailyLimit > 0n ? (budget.dailySpent * 10000n) / dailyLimit : 0n;
	const monthlyUtilBps =
		monthlyLimit > 0n
			? (budget.monthlySpent * 10000n) / monthlyLimit
			: 0n;
	const maxUtilBps =
		dailyUtilBps > monthlyUtilBps ? dailyUtilBps : monthlyUtilBps;

	const alertLevel = classifyAlert(maxUtilBps, BigInt(config.thresholdYellow), BigInt(config.thresholdRed));

	runtime.log(
		`Budget: agent=${agentAddress}, daily=${dailyUtilBps}bps, monthly=${monthlyUtilBps}bps, level=${alertLevel}`,
	);

	// Score penalty for CRITICAL overspend (with idempotency)
	const nowSec = BigInt(Math.floor(runtime.now().getTime() / 1000));
	const penaltyAmount = BigInt(config.maxPenalty);
	const minPenaltyInterval = BigInt(config.minPenaltyIntervalSec);
	let adjustedScore = currentScore;
	if (alertLevel === "CRITICAL") {
		const timeSinceLastUpdate = nowSec - lastUpdated;
		if (timeSinceLastUpdate >= minPenaltyInterval) {
			adjustedScore = currentScore > penaltyAmount ? currentScore - penaltyAmount : 0n;
		} else {
			adjustedScore = currentScore; // Don't re-penalize within interval
			runtime.log(`Skipping penalty: last update ${timeSinceLastUpdate}s ago (min interval: ${minPenaltyInterval}s)`);
		}
	}

	const encoded = encodeAbiParameters(
		parseAbiParameters("address agent, uint256 score, uint256 timestamp"),
		[agentAddress as Address, adjustedScore, nowSec],
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

	runtime.log(`Budget report written on-chain for agent ${agentAddress}`);

	return JSON.stringify({
		agent: agentAddress,
		alertLevel,
		dailyUtilizationBps: dailyUtilBps.toString(),
		monthlyUtilizationBps: monthlyUtilBps.toString(),
		adjustedScore: adjustedScore.toString(),
	});
};

const initWorkflow = (config: Config) => {
	const network = getNetwork({
		chainFamily: "evm",
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	});
	if (!network)
		throw new Error(`Network not found: ${config.chainSelectorName}`);

	const evmClient = new EVMClient(network.chainSelector.selector);

	return [
		handler(
			evmClient.logTrigger(
				logTriggerConfig({
					addresses: [config.budgetEnforcerAddress as `0x${string}`],
					topics: [[EVENT_SIGNATURES.SpendRecorded]],
				}),
			),
			onSpendRecorded,
		),
	];
};

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema });
	await runner.run(initWorkflow);
}
