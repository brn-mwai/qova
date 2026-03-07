/**
 * Transaction Monitor -- CRE Workflow
 *
 * Trigger: EVM Log (TransactionRecorded events on TransactionValidator)
 * Flow: Decode event -> read context -> anomaly detection -> write report
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
	zeroAddress,
	type Address,
} from "viem";
import { z } from "zod";
import {
	REPUTATION_REGISTRY_ABI,
	TRANSACTION_VALIDATOR_ABI,
	EVENT_SIGNATURES,
} from "../shared/contracts";

const configSchema = z.object({
	chainSelectorName: z.string(),
	reputationRegistryAddress: z.string(),
	transactionValidatorAddress: z.string(),
	gasLimit: z.string(),
});
type Config = z.infer<typeof configSchema>;

const onTransactionRecorded = (
	runtime: Runtime<Config>,
	log: EVMLog,
): string => {
	const config = runtime.config;

	const rawTopic = bytesToHex(log.topics[1] ?? new Uint8Array());
	const agentAddress = `0x${rawTopic.slice(-40)}` as Address;
	const txHash = bytesToHex(log.txHash);
	runtime.log(`Transaction detected: agent=${agentAddress}, tx=${txHash}`);

	const network = getNetwork({
		chainFamily: "evm",
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	});
	if (!network)
		throw new Error(`Network not found: ${config.chainSelectorName}`);

	const evmClient = new EVMClient(network.chainSelector.selector);

	// EVM Read 1: Current reputation score
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

	// EVM Read 2: Transaction statistics
	const statsResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.transactionValidatorAddress as Address,
				data: encodeFunctionData({
					abi: TRANSACTION_VALIDATOR_ABI,
					functionName: "getTransactionStats",
					args: [agentAddress as Address],
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

	// Anomaly detection (all BigInt)
	const nowSec = BigInt(Math.floor(runtime.now().getTime() / 1000));

	const logDataHex = bytesToHex(log.data);
	const latestTxValue =
		logDataHex.length >= 66 ? BigInt(`0x${logDataHex.slice(2, 66)}`) : 0n;

	const failureCount =
		stats.totalCount > stats.successCount
			? stats.totalCount - stats.successCount
			: 0n;
	const failureRateBps =
		stats.totalCount > 0n
			? (failureCount * 10000n) / stats.totalCount
			: 0n;

	const avgTxValue =
		stats.totalCount > 0n ? stats.totalVolume / stats.totalCount : 0n;

	const largeValueRisk =
		avgTxValue > 0n && latestTxValue > avgTxValue * 5n ? 100n : 0n;
	const failureRisk = failureRateBps > 2000n ? 100n : 0n;
	const frequencyRisk = stats.totalCount > 100n ? 50n : 0n;

	const riskScore =
		(largeValueRisk * 30n + failureRisk * 40n + frequencyRisk * 30n) / 100n;

	const severity =
		riskScore >= 75n
			? "CRITICAL"
			: riskScore >= 50n
				? "HIGH"
				: riskScore >= 25n
					? "MEDIUM"
					: "LOW";

	runtime.log(
		`Anomaly: agent=${agentAddress}, risk=${riskScore}, severity=${severity}`,
	);

	// Score penalty for high risk
	let adjustedScore = currentScore;
	if (riskScore > 75n) {
		adjustedScore = currentScore > 50n ? currentScore - 50n : 0n;
	} else if (riskScore > 50n) {
		adjustedScore = currentScore > 25n ? currentScore - 25n : 0n;
	}

	// Write monitoring report on-chain
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

	runtime.log(`Report written on-chain for agent ${agentAddress}`);

	return JSON.stringify({
		agent: agentAddress,
		riskScore: riskScore.toString(),
		severity,
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
					addresses: [config.transactionValidatorAddress as `0x${string}`],
					topics: [[EVENT_SIGNATURES.TransactionRecorded]],
				}),
			),
			onTransactionRecorded,
		),
	];
};

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema });
	await runner.run(initWorkflow);
}
