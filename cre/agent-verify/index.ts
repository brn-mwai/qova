/**
 * @file agent-verify/index.ts
 * CRE Workflow: Agent Verify
 *
 * Trigger: HTTP POST /verify
 * Purpose: Performs comprehensive on-demand agent verification. Reads on-chain
 *          registration, reputation, transaction stats, and budget status. Fetches
 *          contract creation details and sanctions screening off-chain. Runs 8
 *          verification checks covering registration, contract existence, age,
 *          owner consistency, recent activity, ownership stability, sanctions,
 *          and minimum score. Returns VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED,
 *          or SUSPICIOUS status with a credit grade (AAA through D).
 */

import {
	bytesToHex,
	consensusIdenticalAggregation,
	cre,
	encodeCallMsg,
	getNetwork,
	type HTTPPayload,
	type HTTPSendRequester,
	json,
	LAST_FINALIZED_BLOCK_NUMBER,
	ok,
	prepareReportRequest,
	Runner,
	type Runtime,
} from "@chainlink/cre-sdk";
import {
	type Address,
	decodeFunctionResult,
	encodeFunctionData,
	keccak256,
	toHex,
	zeroAddress,
} from "viem";
import { CRE_REASONS } from "../shared/constants";
import {
	BUDGET_ENFORCER_ABI,
	REPUTATION_REGISTRY_ABI,
	TRANSACTION_VALIDATOR_ABI,
} from "../shared/contracts";
import {
	type AgentVerifyConfig,
	AgentVerifyConfigSchema,
	type VerificationReport,
} from "../shared/types";
import { computeVerification, type VerificationInput } from "../shared/verification";

export async function main(): Promise<void> {
	const runner = await Runner.newRunner<AgentVerifyConfig>({
		configSchema: AgentVerifyConfigSchema,
	});
	await runner.run(initWorkflow);
}

function initWorkflow(_config: AgentVerifyConfig) {
	const httpCapability = new cre.capabilities.HTTPCapability();
	const httpTrigger = httpCapability.trigger({});

	return [
		cre.handler(httpTrigger, (runtime: Runtime<AgentVerifyConfig>, payload: HTTPPayload) =>
			onVerifyRequest(runtime, payload),
		),
	];
}

function onVerifyRequest(runtime: Runtime<AgentVerifyConfig>, payload: HTTPPayload): string {
	const config = runtime.config;
	const { chainSelectorName, reputationRegistry, transactionValidator, budgetEnforcer } =
		config.evm;

	// ── Parse request body ──
	const bodyStr = new TextDecoder().decode(payload.input);
	let requestBody: { agent?: string };
	try {
		requestBody = JSON.parse(bodyStr);
	} catch {
		return JSON.stringify({ error: "Invalid JSON body" });
	}

	const agentAddress = requestBody.agent;
	if (!agentAddress) {
		return JSON.stringify({ error: "Missing agent address in request body" });
	}

	runtime.log(`Verifying agent: ${agentAddress}`);

	const network = getNetwork({ chainFamily: "evm", chainSelectorName, isTestnet: true });
	if (!network) throw new Error(`Network not found: ${chainSelectorName}`);

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
	const httpClient = new cre.capabilities.HTTPClient();

	// ── Step 1: Check if agent is registered ──
	const isRegisteredCallData = encodeFunctionData({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "isRegistered",
		args: [agentAddress as Address],
	});

	const isRegisteredResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: reputationRegistry as Address,
				data: isRegisteredCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const isRegistered = decodeFunctionResult({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "isRegistered",
		data: bytesToHex(isRegisteredResult.data),
	}) as boolean;

	// ── Step 2: Read agent details (score, lastUpdated, updateCount) ──
	const detailsCallData = encodeFunctionData({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "getAgentDetails",
		args: [agentAddress as Address],
	});

	const detailsResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: reputationRegistry as Address,
				data: detailsCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const agentDetails = decodeFunctionResult({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "getAgentDetails",
		data: bytesToHex(detailsResult.data),
	}) as unknown as {
		score: number;
		lastUpdated: bigint;
		updateCount: bigint;
		registered: boolean;
	};

	const score = agentDetails.score;
	const registrationTimestamp = Number(agentDetails.lastUpdated);

	// ── Step 3: Read transaction statistics ──
	const statsCallData = encodeFunctionData({
		abi: TRANSACTION_VALIDATOR_ABI,
		functionName: "getTransactionStats",
		args: [agentAddress as Address],
	});

	const statsResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: transactionValidator as Address,
				data: statsCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const stats = decodeFunctionResult({
		abi: TRANSACTION_VALIDATOR_ABI,
		functionName: "getTransactionStats",
		data: bytesToHex(statsResult.data),
	}) as unknown as {
		totalCount: bigint;
		totalVolume: bigint;
		successCount: bigint;
		lastActivityTimestamp: bigint;
	};

	// ── Step 4: Read success rate ──
	const successRateCallData = encodeFunctionData({
		abi: TRANSACTION_VALIDATOR_ABI,
		functionName: "getSuccessRate",
		args: [agentAddress as Address],
	});

	const successRateResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: transactionValidator as Address,
				data: successRateCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const successRate = decodeFunctionResult({
		abi: TRANSACTION_VALIDATOR_ABI,
		functionName: "getSuccessRate",
		data: bytesToHex(successRateResult.data),
	}) as bigint;

	// ── Step 5: Check budget status ──
	const hasBudgetCallData = encodeFunctionData({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "hasBudget",
		args: [agentAddress as Address],
	});

	const hasBudgetResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: budgetEnforcer as Address,
				data: hasBudgetCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const hasBudget = decodeFunctionResult({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "hasBudget",
		data: bytesToHex(hasBudgetResult.data),
	}) as boolean;

	// ── Step 6: Fetch off-chain contract metadata and verification data ──
	const fetchContractInfo = (
		sendRequester: HTTPSendRequester,
		rpcUrl: string,
	): {
		contractExists: boolean;
		creationTimestamp: number;
		ownerAddress: string;
		ownerConsistent: boolean;
		recentOwnershipTransfer: boolean;
		lastOwnershipTransferTimestamp: number;
	} => {
		const response = sendRequester
			.sendRequest({
				url: `${rpcUrl}/contract-info`,
				method: "POST",
				body: JSON.stringify({ agent: agentAddress }),
			})
			.result();
		if (!ok(response)) throw new Error(`Contract info fetch failed: ${response.statusCode}`);
		return json(response) as {
			contractExists: boolean;
			creationTimestamp: number;
			ownerAddress: string;
			ownerConsistent: boolean;
			recentOwnershipTransfer: boolean;
			lastOwnershipTransferTimestamp: number;
		};
	};

	const contractInfo = httpClient
		.sendRequest(
			runtime,
			fetchContractInfo,
			consensusIdenticalAggregation(),
		)(config.sanctionsApiUrl)
		.result();

	// ── Step 7: Run sanctions screening ──
	const checkSanctions = (
		sendRequester: HTTPSendRequester,
		apiUrl: string,
	): { clean: boolean; source: string } => {
		const response = sendRequester
			.sendRequest({
				url: `${apiUrl}/check`,
				method: "POST",
				body: JSON.stringify({ agent: agentAddress }),
			})
			.result();
		if (!ok(response)) throw new Error(`Sanctions check failed: ${response.statusCode}`);
		return json(response) as { clean: boolean; source: string };
	};

	const sanctionsResult = httpClient
		.sendRequest(
			runtime,
			checkSanctions,
			consensusIdenticalAggregation(),
		)(config.sanctionsApiUrl)
		.result();

	// ── Step 8: Run comprehensive verification computation ──
	const now = runtime.now();
	const currentTimestamp = Math.floor(now.getTime() / 1000);

	const verificationInput: VerificationInput = {
		isRegistered,
		score,
		registrationTimestamp,
		contractExists: contractInfo.contractExists,
		contractCreationTimestamp: contractInfo.creationTimestamp,
		ownerAddress: contractInfo.ownerAddress,
		ownerConsistent: contractInfo.ownerConsistent,
		transactionCount: Number(stats.totalCount),
		lastActivityTimestamp: Number(stats.lastActivityTimestamp),
		recentOwnershipTransfer: contractInfo.recentOwnershipTransfer,
		lastOwnershipTransferTimestamp: contractInfo.lastOwnershipTransferTimestamp,
		sanctionsClean: sanctionsResult.clean,
		currentTimestamp,
		hasBudget,
	};

	const verification = computeVerification(verificationInput);

	runtime.log(
		`Verification complete: agent=${agentAddress}, status=${verification.status}, grade=${verification.grade}, checks=${verification.checksPassed}/${verification.checksTotal}`,
	);

	// ── Step 9: Build verification report ──
	const isActive =
		Number(stats.lastActivityTimestamp) > 0 &&
		currentTimestamp - Number(stats.lastActivityTimestamp) <= 30 * 86400;

	const report: VerificationReport = {
		agent: agentAddress,
		status: verification.status,
		grade: verification.grade,
		score,
		checks: verification.checks,
		checksPassed: verification.checksPassed,
		checksTotal: verification.checksTotal,
		isRegistered,
		hasBudget,
		sanctionsClean: sanctionsResult.clean,
		activity: {
			totalTransactions: Number(stats.totalCount),
			successRate: Number(successRate),
			totalVolume: stats.totalVolume.toString(),
			lastActivityTimestamp: Number(stats.lastActivityTimestamp),
			isActive,
		},
		timestamp: currentTimestamp,
	};

	// ── Step 10: Write verification attestation on-chain ──
	const reason = keccak256(toHex(CRE_REASONS.agentVerify));

	// If agent is SUSPICIOUS, apply a score penalty
	let adjustedScore = score;
	if (verification.status === "SUSPICIOUS") {
		adjustedScore = Math.max(0, score - 100);
	} else if (verification.status === "UNVERIFIED") {
		adjustedScore = Math.max(0, score - 50);
	}

	const writeCallData = encodeFunctionData({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "updateScore",
		args: [agentAddress as Address, adjustedScore, reason],
	});

	const creReport = runtime.report(prepareReportRequest(writeCallData)).result();

	evmClient
		.writeReport(runtime, {
			receiver: reputationRegistry,
			report: creReport,
		})
		.result();

	runtime.log(`Verification report written on-chain: ${agentAddress} -> ${verification.status}`);

	return JSON.stringify(report);
}

main();
