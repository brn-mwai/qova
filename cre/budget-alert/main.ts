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

const configSchema = z.object({
	chainSelectorName: z.string(),
	reputationRegistryAddress: z.string(),
	budgetEnforcerAddress: z.string(),
	gasLimit: z.string(),
});
type Config = z.infer<typeof configSchema>;

const THRESHOLD_YELLOW = 7000n;
const THRESHOLD_RED = 9000n;

function classifyAlert(bps: bigint): "GREEN" | "YELLOW" | "RED" | "CRITICAL" {
	if (bps > 10000n) return "CRITICAL";
	if (bps > THRESHOLD_RED) return "RED";
	if (bps >= THRESHOLD_YELLOW) return "YELLOW";
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
	const budgetResult = evmClient
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
		.result();

	const rawBudget = decodeFunctionResult({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "getBudgetStatus",
		data: bytesToHex(budgetResult.data),
	}) as unknown as Record<string, number | bigint>;
	const budget = {
		dailyRemaining: BigInt(rawBudget.dailyRemaining ?? 0),
		monthlyRemaining: BigInt(rawBudget.monthlyRemaining ?? 0),
		dailySpent: BigInt(rawBudget.dailySpent ?? 0),
		monthlySpent: BigInt(rawBudget.monthlySpent ?? 0),
	};

	// EVM Read 2: Current reputation score
	const scoreResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.reputationRegistryAddress as Address,
				data: encodeFunctionData({
					abi: REPUTATION_REGISTRY_ABI,
					functionName: "getScore",
					args: [agentAddress as Address],
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

	const alertLevel = classifyAlert(maxUtilBps);

	runtime.log(
		`Budget: agent=${agentAddress}, daily=${dailyUtilBps}bps, monthly=${monthlyUtilBps}bps, level=${alertLevel}`,
	);

	// Score penalty for CRITICAL overspend
	let adjustedScore = currentScore;
	if (alertLevel === "CRITICAL") {
		adjustedScore = currentScore > 25n ? currentScore - 25n : 0n;
	}

	// Write budget report on-chain
	const nowSec = BigInt(Math.floor(runtime.now().getTime() / 1000));

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
