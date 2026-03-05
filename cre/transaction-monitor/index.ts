/**
 * @file transaction-monitor/index.ts
 * CRE Workflow: Transaction Monitor
 *
 * Trigger: EVM Log (TransactionRecorded events on TransactionValidator)
 * Purpose: Reacts to new agent transactions, reads on-chain transaction history,
 *          computes anomaly risk scores using frequency, value, failure rate, and
 *          flagged contract analysis, then writes a monitoring report on-chain
 *          and sends webhook alerts for high-risk findings.
 */

import {
	bytesToHex,
	consensusIdenticalAggregation,
	cre,
	type EVMLog,
	encodeCallMsg,
	getNetwork,
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
	EVENT_SIGNATURES,
	REPUTATION_REGISTRY_ABI,
	TRANSACTION_VALIDATOR_ABI,
} from "../shared/contracts";
import { computeAnomalyReport, type MonitoringMetrics } from "../shared/monitoring";
import {
	type MonitoringReport,
	type TransactionMonitorConfig,
	TransactionMonitorConfigSchema,
} from "../shared/types";

export async function main(): Promise<void> {
	const runner = await Runner.newRunner<TransactionMonitorConfig>({
		configSchema: TransactionMonitorConfigSchema,
	});
	await runner.run(initWorkflow);
}

function initWorkflow(config: TransactionMonitorConfig) {
	const { chainSelectorName, transactionValidator } = config.evm;

	const network = getNetwork({ chainFamily: "evm", chainSelectorName, isTestnet: true });
	if (!network) throw new Error(`Network not found: ${chainSelectorName}`);

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

	// EVM Log trigger -- fires when TransactionRecorded event is emitted
	// TransactionRecorded(address indexed agent, bytes32 indexed txHash, uint256 amount, uint8 txType, uint48 timestamp)
	const logTrigger = evmClient.logTrigger({
		addresses: [transactionValidator],
		topics: [{ values: [EVENT_SIGNATURES.TransactionRecorded] }],
	});

	return [
		cre.handler(logTrigger, (runtime: Runtime<TransactionMonitorConfig>, log: EVMLog) =>
			onTransactionRecorded(runtime, log),
		),
	];
}

function onTransactionRecorded(runtime: Runtime<TransactionMonitorConfig>, log: EVMLog): string {
	const config = runtime.config;
	const { chainSelectorName, transactionValidator, reputationRegistry } = config.evm;

	// Extract data from the EVM log
	const agentAddress = bytesToHex(log.topics[1] ?? new Uint8Array());
	const txHash = bytesToHex(log.topics[2] ?? new Uint8Array());
	const logData = bytesToHex(log.data);

	runtime.log(`Transaction detected: agent=${agentAddress}, tx=${txHash}`);

	const network = getNetwork({ chainFamily: "evm", chainSelectorName, isTestnet: true });
	if (!network) throw new Error(`Network not found: ${chainSelectorName}`);

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
	const httpClient = new cre.capabilities.HTTPClient();

	// ── Step 1: Read agent's current reputation score ──
	const scoreCallData = encodeFunctionData({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "getScore",
		args: [agentAddress as Address],
	});

	const scoreResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: reputationRegistry as Address,
				data: scoreCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const currentScore = decodeFunctionResult({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "getScore",
		data: bytesToHex(scoreResult.data),
	}) as number;

	// ── Step 2: Read transaction statistics from TransactionValidator ──
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

	// ── Step 3: Fetch off-chain transaction enrichment via HTTP consensus ──
	const fetchTxDetails = (
		sendRequester: HTTPSendRequester,
		apiUrl: string,
	): {
		recentTxCount: number;
		avgValueWei: string;
		failedTxCount: number;
		flaggedContracts: string[];
	} => {
		const response = sendRequester
			.sendRequest({
				url: `${apiUrl}/tx-details`,
				method: "POST",
				body: JSON.stringify({
					agent: agentAddress,
					txHash,
					logData,
				}),
			})
			.result();
		if (!ok(response)) throw new Error(`Transaction details fetch failed: ${response.statusCode}`);
		return json(response) as {
			recentTxCount: number;
			avgValueWei: string;
			failedTxCount: number;
			flaggedContracts: string[];
		};
	};

	const txDetails = httpClient
		.sendRequest(
			runtime,
			fetchTxDetails,
			consensusIdenticalAggregation(),
		)(config.scoringApiUrl)
		.result();

	// ── Step 4: Parse the transaction amount from log data ──
	// Log data contains: uint256 amount, uint8 txType, uint48 timestamp (ABI-encoded)
	// The amount is the first 32-byte word
	const latestTxValue = logData.length >= 66 ? BigInt(`0x${logData.slice(2, 66)}`) : 0n;

	// ── Step 5: Compute anomaly report ──
	const now = runtime.now();
	const currentTimestamp = Math.floor(now.getTime() / 1000);

	const metrics: MonitoringMetrics = {
		totalCount: Number(stats.totalCount),
		successCount: Number(stats.successCount),
		totalVolume: stats.totalVolume,
		latestTxValue,
		latestTxTimestamp: Number(stats.lastActivityTimestamp),
		firstActivityTimestamp:
			Number(stats.lastActivityTimestamp) > 0
				? Number(stats.lastActivityTimestamp) - Number(stats.totalCount) * 3600
				: 0,
		interactedWithFlagged: txDetails.flaggedContracts.length > 0,
		currentTimestamp,
	};

	const anomaly = computeAnomalyReport(metrics);
	const failureRate =
		Number(stats.totalCount) > 0
			? (Number(stats.totalCount) - Number(stats.successCount)) / Number(stats.totalCount)
			: 0;

	runtime.log(
		`Anomaly analysis: agent=${agentAddress}, risk=${anomaly.riskScore}, severity=${anomaly.severity}, flags=${anomaly.flags.length}`,
	);

	// ── Step 6: Build monitoring report ──
	const report: MonitoringReport = {
		agent: agentAddress,
		riskScore: anomaly.riskScore,
		severity: anomaly.severity,
		flags: anomaly.flags,
		currentReputationScore: currentScore,
		txStats: {
			totalCount: Number(stats.totalCount),
			successCount: Number(stats.successCount),
			totalVolume: stats.totalVolume.toString(),
			failureRate,
		},
		alertTriggered: anomaly.severity !== "LOW",
		timestamp: currentTimestamp,
	};

	// ── Step 7: Write monitoring report on-chain via CRE report ──
	const reason = keccak256(toHex(CRE_REASONS.transactionMonitor));
	const writeCallData = encodeFunctionData({
		abi: REPUTATION_REGISTRY_ABI,
		functionName: "updateScore",
		args: [
			agentAddress as Address,
			anomaly.riskScore > 75 ? (Math.max(0, currentScore - 50) as unknown as number) : currentScore,
			reason,
		],
	});

	const creReport = runtime.report(prepareReportRequest(writeCallData)).result();

	evmClient
		.writeReport(runtime, {
			receiver: reputationRegistry,
			report: creReport,
		})
		.result();

	runtime.log(`Monitoring report written on-chain for agent ${agentAddress}`);

	// ── Step 8: Send alert webhook if risk is elevated ──
	if (anomaly.severity !== "LOW" && config.alertWebhookUrl) {
		const sendAlert = (sendRequester: HTTPSendRequester, webhookUrl: string): string => {
			const response = sendRequester
				.sendRequest({
					url: webhookUrl,
					method: "POST",
					body: JSON.stringify({
						type: "TRANSACTION_ANOMALY",
						severity: anomaly.severity,
						agent: agentAddress,
						txHash,
						riskScore: anomaly.riskScore,
						flags: anomaly.flags.map((f) => f.type),
						flagDetails: anomaly.flags.map((f) => f.description),
						currentScore,
						failureRate,
						timestamp: currentTimestamp,
					}),
				})
				.result();
			return ok(response) ? "alert_sent" : "alert_failed";
		};

		httpClient
			.sendRequest(
				runtime,
				sendAlert,
				consensusIdenticalAggregation(),
			)(config.alertWebhookUrl)
			.result();

		runtime.log(
			`Alert sent for agent ${agentAddress}: risk=${anomaly.riskScore}, severity=${anomaly.severity}`,
		);
	}

	return JSON.stringify(report);
}

main();
