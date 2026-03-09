/**
 * Qova Trigger node -- polls for agent score changes.
 *
 * Monitors an agent's reputation score at a configurable interval and
 * triggers the downstream workflow when the score changes beyond a
 * user-defined threshold.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";
import { qovaApiRequest, isValidAddress } from "./GenericFunctions";

export class QovaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Qova Trigger",
		name: "qovaTrigger",
		icon: "file:qova.svg",
		group: ["trigger"],
		version: 1,
		subtitle: "Score change monitor",
		description:
			"Triggers when an AI agent reputation score changes beyond a threshold",
		defaults: {
			name: "Qova Trigger",
		},
		polling: true,
		inputs: [],
		outputs: ["main"],
		credentials: [
			{
				name: "qovaApi",
				required: true,
			},
		],
		properties: [
			{
				displayName: "Agent Address",
				name: "agentAddress",
				type: "string",
				required: true,
				default: "",
				placeholder: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
				description: "The Ethereum address of the AI agent to monitor",
			},
			{
				displayName: "Trigger On",
				name: "triggerOn",
				type: "options",
				options: [
					{
						name: "Any Change",
						value: "anyChange",
						description: "Trigger when the score changes by any amount",
					},
					{
						name: "Threshold Change",
						value: "threshold",
						description:
							"Trigger only when the score changes by more than the specified threshold",
					},
					{
						name: "Grade Change",
						value: "gradeChange",
						description:
							"Trigger when the letter grade changes (e.g. B to C, or C to A)",
					},
					{
						name: "Score Below",
						value: "scoreBelow",
						description:
							"Trigger when the score drops below a specific value",
					},
					{
						name: "Score Above",
						value: "scoreAbove",
						description:
							"Trigger when the score rises above a specific value",
					},
				],
				default: "anyChange",
				description: "The condition that triggers the workflow",
			},
			{
				displayName: "Threshold",
				name: "threshold",
				type: "number",
				default: 50,
				typeOptions: { minValue: 1, maxValue: 1000 },
				description:
					"Minimum score change (absolute value) required to trigger the workflow",
				displayOptions: {
					show: {
						triggerOn: ["threshold"],
					},
				},
			},
			{
				displayName: "Score Value",
				name: "scoreValue",
				type: "number",
				default: 500,
				typeOptions: { minValue: 0, maxValue: 1000 },
				description: "The score threshold value to compare against",
				displayOptions: {
					show: {
						triggerOn: ["scoreBelow", "scoreAbove"],
					},
				},
			},
			{
				displayName: "Include Breakdown",
				name: "includeBreakdown",
				type: "boolean",
				default: false,
				description:
					"Whether to include the full 5-factor score breakdown in the trigger output",
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const agentAddress = this.getNodeParameter("agentAddress") as string;
		const triggerOn = this.getNodeParameter("triggerOn") as string;
		const includeBreakdown = this.getNodeParameter("includeBreakdown") as boolean;

		if (!isValidAddress(agentAddress)) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid Ethereum address: "${agentAddress}"`,
			);
		}

		// Fetch current score
		const scoreData = (await qovaApiRequest.call(
			this,
			"GET",
			`/api/agents/${agentAddress}/score`,
		)) as IDataObject;

		const currentScore = scoreData.score as number;
		const currentGrade = scoreData.grade as string;

		// Retrieve previous state from workflow static data
		const workflowStaticData = this.getWorkflowStaticData("node");
		const previousScore = workflowStaticData.lastScore as number | undefined;
		const previousGrade = workflowStaticData.lastGrade as string | undefined;

		// Always update stored state
		workflowStaticData.lastScore = currentScore;
		workflowStaticData.lastGrade = currentGrade;

		// First poll -- store baseline, don't trigger
		if (previousScore === undefined) {
			return null;
		}

		// Determine if we should trigger
		let shouldTrigger = false;
		let triggerReason = "";

		const scoreDelta = currentScore - previousScore;
		const absoluteDelta = Math.abs(scoreDelta);

		switch (triggerOn) {
			case "anyChange":
				shouldTrigger = absoluteDelta > 0;
				triggerReason = `Score changed by ${scoreDelta > 0 ? "+" : ""}${scoreDelta}`;
				break;

			case "threshold": {
				const threshold = this.getNodeParameter("threshold") as number;
				shouldTrigger = absoluteDelta >= threshold;
				triggerReason = `Score changed by ${scoreDelta > 0 ? "+" : ""}${scoreDelta} (threshold: ${threshold})`;
				break;
			}

			case "gradeChange":
				shouldTrigger = currentGrade !== previousGrade;
				triggerReason = `Grade changed from ${previousGrade} to ${currentGrade}`;
				break;

			case "scoreBelow": {
				const scoreValue = this.getNodeParameter("scoreValue") as number;
				shouldTrigger = currentScore < scoreValue && previousScore >= scoreValue;
				triggerReason = `Score dropped below ${scoreValue} (now ${currentScore})`;
				break;
			}

			case "scoreAbove": {
				const scoreValue = this.getNodeParameter("scoreValue") as number;
				shouldTrigger = currentScore > scoreValue && previousScore <= scoreValue;
				triggerReason = `Score rose above ${scoreValue} (now ${currentScore})`;
				break;
			}
		}

		if (!shouldTrigger) {
			return null;
		}

		// Build output
		const output: IDataObject = {
			agent: agentAddress,
			currentScore,
			previousScore,
			scoreDelta,
			currentGrade,
			previousGrade: previousGrade ?? currentGrade,
			triggerReason,
			timestamp: new Date().toISOString(),
			...scoreData,
		};

		// Optionally fetch full breakdown
		if (includeBreakdown) {
			const breakdown = (await qovaApiRequest.call(
				this,
				"GET",
				`/api/scores/${agentAddress}`,
			)) as IDataObject;
			output.breakdown = breakdown;
		}

		return [[{ json: output }]];
	}
}
