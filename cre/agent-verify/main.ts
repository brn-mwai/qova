/**
 * Agent Verify -- CRE Workflow
 *
 * Trigger: HTTP POST
 * Flow: Parse request -> read 3 contracts -> compute verification -> write report
 * Quota budget: 3 EVM reads, 1 EVM write
 */
import {
	Runner,
	handler,
	HTTPCapability,
	EVMClient,
	getNetwork,
	encodeCallMsg,
	bytesToHex,
	hexToBase64,
	LAST_FINALIZED_BLOCK_NUMBER,
	type Runtime,
	type HTTPPayload,
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

const configSchema = z.object({
	chainSelectorName: z.string(),
	reputationRegistryAddress: z.string(),
	transactionValidatorAddress: z.string(),
	budgetEnforcerAddress: z.string(),
	gasLimit: z.string(),
});
type Config = z.infer<typeof configSchema>;

function computeGrade(score: bigint): string {
	if (score >= 950n) return "AAA";
	if (score >= 850n) return "A";
	if (score >= 750n) return "BBB";
	if (score >= 650n) return "BB";
	if (score >= 550n) return "B";
	if (score >= 350n) return "CC";
	return "D";
}

const onVerifyRequest = (
	runtime: Runtime<Config>,
	payload: HTTPPayload,
): string => {
	const config = runtime.config;

	let requestBody: { agent?: string };
	try {
		const bodyStr = new TextDecoder().decode(payload.input);
		requestBody = JSON.parse(bodyStr);
	} catch {
		return JSON.stringify({ error: "Invalid JSON body" });
	}

	const agentAddress = requestBody.agent;
	if (!agentAddress) {
		return JSON.stringify({ error: "Missing agent address" });
	}

	runtime.log(`Verifying agent: ${agentAddress}`);

	const network = getNetwork({
		chainFamily: "evm",
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	});
	if (!network)
		throw new Error(`Network not found: ${config.chainSelectorName}`);

	const evmClient = new EVMClient(network.chainSelector.selector);

	// EVM Read 1: Agent details (score, lastUpdated, registered)
	const detailsResult = evmClient
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
		.result();

	const rawDetails = decodeFunctionResult({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "getAgentDetails",
		data: bytesToHex(detailsResult.data),
	}) as unknown as Record<string, number | bigint | boolean>;
	const agentDetails = {
		score: BigInt(rawDetails.score ?? 0),
		lastUpdated: BigInt(rawDetails.lastUpdated ?? 0),
		updateCount: BigInt(rawDetails.updateCount ?? 0),
		registered: Boolean(rawDetails.registered),
	};

	// EVM Read 2: Transaction stats
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

	// EVM Read 3: Has budget?
	const hasBudgetResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: config.budgetEnforcerAddress as Address,
				data: encodeFunctionData({
					abi: BUDGET_ENFORCER_ABI,
					functionName: "hasBudget",
					args: [agentAddress as Address],
				}),
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const hasBudget = decodeFunctionResult({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "hasBudget",
		data: bytesToHex(hasBudgetResult.data),
	}) as boolean;

	// Verification checks
	const nowSec = BigInt(Math.floor(runtime.now().getTime() / 1000));
	const score = agentDetails.score;
	const MAX_INACTIVITY_SEC = 30n * 86400n;
	const MIN_SCORE = 100n;

	let passedCount = 0n;
	const isRegistered = agentDetails.registered;
	if (isRegistered) passedCount += 1n;

	const hasActivity = stats.totalCount > 0n;
	if (hasActivity) passedCount += 1n;

	const timeSinceActivity =
		stats.lastActivityTimestamp > 0n
			? nowSec - stats.lastActivityTimestamp
			: nowSec;
	const isActive =
		stats.totalCount > 0n && timeSinceActivity <= MAX_INACTIVITY_SEC;
	if (isActive) passedCount += 1n;

	if (hasBudget) passedCount += 1n;

	if (score >= MIN_SCORE) passedCount += 1n;

	// Classify verification status
	const totalChecks = 5n;
	let status: string;
	if (!isRegistered) {
		status = "UNVERIFIED";
	} else if (passedCount === totalChecks) {
		status = "VERIFIED";
	} else if (passedCount * 4n >= totalChecks * 3n) {
		status = "PARTIALLY_VERIFIED";
	} else {
		status = "UNVERIFIED";
	}

	const grade = computeGrade(score);

	runtime.log(
		`Verification: agent=${agentAddress}, status=${status}, grade=${grade}, passed=${passedCount}/${totalChecks}`,
	);

	// Score adjustment
	let adjustedScore = score;
	if (status === "UNVERIFIED" && passedCount * 2n < totalChecks) {
		adjustedScore = score > 50n ? score - 50n : 0n;
	}

	// Write verification attestation on-chain
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

	runtime.log(`Verification written on-chain: ${agentAddress} -> ${status}`);

	return JSON.stringify({
		agent: agentAddress,
		status,
		grade,
		score: score.toString(),
		passedChecks: passedCount.toString(),
		totalChecks: totalChecks.toString(),
		isRegistered,
		hasBudget,
		isActive,
		totalTransactions: stats.totalCount.toString(),
		timestamp: nowSec.toString(),
	});
};

const initWorkflow = (_config: Config) => {
	const http = new HTTPCapability();
	return [
		handler(
			http.trigger({}),
			onVerifyRequest,
		),
	];
};

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema });
	await runner.run(initWorkflow);
}
