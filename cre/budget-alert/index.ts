/**
 * @file budget-alert/index.ts
 * CRE Workflow: Budget Alert
 *
 * Trigger: EVM Log (SpendRecorded events on BudgetEnforcer)
 * Purpose: Monitors agent spending against configured budget limits. Reads budget
 *          configuration and cumulative spending from BudgetEnforcer, computes daily
 *          and monthly utilization percentages, determines alert level (Green/Yellow/
 *          Red/Critical), and writes budget reports on-chain. Sends webhook alerts
 *          for Yellow and above.
 */

import {
	bytesToHex,
	consensusIdenticalAggregation,
	cre,
	type EVMLog,
	encodeCallMsg,
	getNetwork,
	type HTTPSendRequester,
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
import { type BudgetMetrics, computeBudgetUtilization, shouldTriggerAlert } from "../shared/budget";
import { CRE_REASONS } from "../shared/constants";
import {
	BUDGET_ENFORCER_ABI,
	EVENT_SIGNATURES,
	REPUTATION_REGISTRY_ABI,
} from "../shared/contracts";
import {
	type BudgetAlertConfig,
	BudgetAlertConfigSchema,
	type BudgetReport,
} from "../shared/types";

export async function main(): Promise<void> {
	const runner = await Runner.newRunner<BudgetAlertConfig>({
		configSchema: BudgetAlertConfigSchema,
	});
	await runner.run(initWorkflow);
}

function initWorkflow(config: BudgetAlertConfig) {
	const { chainSelectorName, budgetEnforcer } = config.evm;

	const network = getNetwork({ chainFamily: "evm", chainSelectorName, isTestnet: true });
	if (!network) throw new Error(`Network not found: ${chainSelectorName}`);

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

	// EVM Log trigger -- fires when SpendRecorded is emitted
	// SpendRecorded(address indexed agent, uint128 amount, uint128 dailyRemaining, uint128 monthlyRemaining)
	const logTrigger = evmClient.logTrigger({
		addresses: [budgetEnforcer],
		topics: [{ values: [EVENT_SIGNATURES.SpendRecorded] }],
	});

	return [
		cre.handler(logTrigger, (runtime: Runtime<BudgetAlertConfig>, log: EVMLog) =>
			onSpendRecorded(runtime, log),
		),
	];
}

function onSpendRecorded(runtime: Runtime<BudgetAlertConfig>, log: EVMLog): string {
	const config = runtime.config;
	const { chainSelectorName, budgetEnforcer, reputationRegistry } = config.evm;

	const agentAddress = bytesToHex(log.topics[1] ?? new Uint8Array());
	runtime.log(`Spend recorded for agent: ${agentAddress}`);

	const network = getNetwork({ chainFamily: "evm", chainSelectorName, isTestnet: true });
	if (!network) throw new Error(`Network not found: ${chainSelectorName}`);

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
	const httpClient = new cre.capabilities.HTTPClient();

	// ── Step 1: Read current budget status from BudgetEnforcer ──
	const budgetCallData = encodeFunctionData({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "getBudgetStatus",
		args: [agentAddress as Address],
	});

	const budgetResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: budgetEnforcer as Address,
				data: budgetCallData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result();

	const budget = decodeFunctionResult({
		abi: BUDGET_ENFORCER_ABI,
		functionName: "getBudgetStatus",
		data: bytesToHex(budgetResult.data),
	}) as {
		dailyRemaining: bigint;
		monthlyRemaining: bigint;
		perTxLimit: bigint;
		dailySpent: bigint;
		monthlySpent: bigint;
	};

	// ── Step 2: Read agent's current reputation score for context ──
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

	// ── Step 3: Compute budget utilization and alert level ──
	const metrics: BudgetMetrics = {
		dailySpent: budget.dailySpent,
		dailyRemaining: budget.dailyRemaining,
		monthlySpent: budget.monthlySpent,
		monthlyRemaining: budget.monthlyRemaining,
		perTxLimit: budget.perTxLimit,
	};

	const utilization = computeBudgetUtilization(metrics);

	runtime.log(
		`Budget analysis: agent=${agentAddress}, daily=${utilization.dailyUtilization.toFixed(1)}%, monthly=${utilization.monthlyUtilization.toFixed(1)}%, level=${utilization.alertLevel}`,
	);

	// ── Step 4: Build budget report ──
	const now = runtime.now();
	const currentTimestamp = Math.floor(now.getTime() / 1000);
	const alertTriggered = shouldTriggerAlert(utilization.alertLevel);

	const report: BudgetReport = {
		agent: agentAddress,
		alertLevel: utilization.alertLevel,
		dailyUtilization: utilization.dailyUtilization,
		monthlyUtilization: utilization.monthlyUtilization,
		budget: {
			dailySpent: budget.dailySpent.toString(),
			dailyRemaining: budget.dailyRemaining.toString(),
			dailyLimit: utilization.dailyLimit.toString(),
			monthlySpent: budget.monthlySpent.toString(),
			monthlyRemaining: budget.monthlyRemaining.toString(),
			monthlyLimit: utilization.monthlyLimit.toString(),
			perTxLimit: budget.perTxLimit.toString(),
		},
		currentReputationScore: currentScore,
		alertTriggered,
		timestamp: currentTimestamp,
	};

	// ── Step 5: Write budget report on-chain via CRE report ──
	// For CRITICAL overspend, apply a score penalty
	const scorePenalty = utilization.alertLevel === "CRITICAL" ? 25 : 0;
	const adjustedScore = Math.max(0, currentScore - scorePenalty);

	const reason = keccak256(toHex(CRE_REASONS.budgetAlert));
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

	runtime.log(`Budget report written on-chain for agent ${agentAddress}`);

	// ── Step 6: Send alert webhook if Yellow or above ──
	if (alertTriggered && config.alertWebhookUrl) {
		const sendAlert = (sendRequester: HTTPSendRequester, webhookUrl: string): string => {
			const response = sendRequester
				.sendRequest({
					url: webhookUrl,
					method: "POST",
					body: JSON.stringify({
						type: "BUDGET_ALERT",
						severity: utilization.alertLevel,
						agent: agentAddress,
						dailyUtilization: utilization.dailyUtilization,
						monthlyUtilization: utilization.monthlyUtilization,
						dailySpent: budget.dailySpent.toString(),
						dailyRemaining: budget.dailyRemaining.toString(),
						dailyLimit: utilization.dailyLimit.toString(),
						monthlySpent: budget.monthlySpent.toString(),
						monthlyRemaining: budget.monthlyRemaining.toString(),
						monthlyLimit: utilization.monthlyLimit.toString(),
						currentScore,
						scorePenaltyApplied: scorePenalty,
						timestamp: currentTimestamp,
						message: `Agent ${agentAddress} budget at ${utilization.maxUtilization.toFixed(1)}% utilization (${utilization.alertLevel})`,
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
			`Budget alert sent: ${agentAddress} at ${utilization.maxUtilization.toFixed(1)}% (${utilization.alertLevel})`,
		);
	}

	return JSON.stringify(report);
}

main();
