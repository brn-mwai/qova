/**
 * Qova n8n community node.
 *
 * Provides access to the Qova AI Agent Credit Bureau API for managing
 * agent reputation scores, transaction recording, and budget enforcement.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";
import { qovaApiRequest, isValidAddress } from "./GenericFunctions";

export class Qova implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Qova",
		name: "qova",
		icon: "file:qova.svg",
		group: ["transform"],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: "Interact with the Qova AI Agent Credit Bureau API",
		defaults: {
			name: "Qova",
		},
		inputs: ["main"],
		outputs: ["main"],
		credentials: [
			{
				name: "qovaApi",
				required: true,
			},
		],
		properties: [
			// ------------------------------------------------------------------
			//  Resource selector
			// ------------------------------------------------------------------
			{
				displayName: "Resource",
				name: "resource",
				type: "options",
				noDataExpression: true,
				options: [
					{
						name: "Agent",
						value: "agent",
						description: "Manage AI agent registration and reputation",
					},
					{
						name: "Score",
						value: "score",
						description: "Query and compute reputation scores",
					},
					{
						name: "Transaction",
						value: "transaction",
						description: "Record agent financial transactions",
					},
					{
						name: "Budget",
						value: "budget",
						description: "Set and check agent budget limits",
					},
				],
				default: "agent",
			},

			// ------------------------------------------------------------------
			//  Agent operations
			// ------------------------------------------------------------------
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ["agent"],
					},
				},
				options: [
					{
						name: "Get Details",
						value: "getDetails",
						description: "Get agent details including enriched reputation score",
						action: "Get agent details",
					},
					{
						name: "Get Score",
						value: "getScore",
						description: "Get the current reputation score, grade, and color for an agent",
						action: "Get agent score",
					},
					{
						name: "Check Registration",
						value: "checkRegistration",
						description: "Check whether an agent address is registered with Qova",
						action: "Check agent registration",
					},
					{
						name: "Register",
						value: "register",
						description: "Register a new AI agent in the Qova reputation system",
						action: "Register agent",
					},
					{
						name: "Update Score",
						value: "updateScore",
						description: "Update an agent reputation score with a reason",
						action: "Update agent score",
					},
				],
				default: "getDetails",
			},

			// ------------------------------------------------------------------
			//  Score operations
			// ------------------------------------------------------------------
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ["score"],
					},
				},
				options: [
					{
						name: "Get Breakdown",
						value: "getBreakdown",
						description:
							"Get a full score breakdown with 5 weighted factors (volume, count, success rate, budget compliance, account age)",
						action: "Get score breakdown",
					},
					{
						name: "Compute",
						value: "compute",
						description:
							"Compute a reputation score from raw metrics without writing to the blockchain",
						action: "Compute score",
					},
				],
				default: "getBreakdown",
			},

			// ------------------------------------------------------------------
			//  Transaction operations
			// ------------------------------------------------------------------
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ["transaction"],
					},
				},
				options: [
					{
						name: "Record",
						value: "record",
						description:
							"Record a new financial transaction for an agent on the blockchain",
						action: "Record transaction",
					},
				],
				default: "record",
			},

			// ------------------------------------------------------------------
			//  Budget operations
			// ------------------------------------------------------------------
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ["budget"],
					},
				},
				options: [
					{
						name: "Get Status",
						value: "getStatus",
						description: "Get the current budget status for an agent",
						action: "Get budget status",
					},
					{
						name: "Set Limits",
						value: "setLimits",
						description:
							"Set daily, monthly, and per-transaction budget limits for an agent",
						action: "Set budget limits",
					},
					{
						name: "Check",
						value: "check",
						description: "Check if a given amount falls within the agent budget limits",
						action: "Check budget",
					},
				],
				default: "getStatus",
			},

			// ------------------------------------------------------------------
			//  Shared: Agent Address
			// ------------------------------------------------------------------
			{
				displayName: "Agent Address",
				name: "agentAddress",
				type: "string",
				required: true,
				default: "",
				placeholder: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
				description: "The Ethereum address (0x...) of the AI agent",
				displayOptions: {
					show: {
						resource: ["agent", "score", "budget"],
					},
					hide: {
						operation: ["register", "compute"],
					},
				},
			},

			// ------------------------------------------------------------------
			//  Agent: Register
			// ------------------------------------------------------------------
			{
				displayName: "Agent Address",
				name: "agentAddress",
				type: "string",
				required: true,
				default: "",
				placeholder: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
				description: "The Ethereum address of the AI agent to register",
				displayOptions: {
					show: {
						resource: ["agent"],
						operation: ["register"],
					},
				},
			},

			// ------------------------------------------------------------------
			//  Agent: Update Score
			// ------------------------------------------------------------------
			{
				displayName: "New Score",
				name: "score",
				type: "number",
				required: true,
				default: 500,
				typeOptions: {
					minValue: 0,
					maxValue: 1000,
				},
				description: "The new reputation score (0-1000). 850+ is excellent, below 300 is poor.",
				displayOptions: {
					show: {
						resource: ["agent"],
						operation: ["updateScore"],
					},
				},
			},
			{
				displayName: "Reason",
				name: "reason",
				type: "string",
				default:
					"0x0000000000000000000000000000000000000000000000000000000000000000",
				description:
					"Hex-encoded reason for the score update (bytes32). Defaults to zero bytes.",
				displayOptions: {
					show: {
						resource: ["agent"],
						operation: ["updateScore"],
					},
				},
			},

			// ------------------------------------------------------------------
			//  Score: Compute (raw metrics input)
			// ------------------------------------------------------------------
			{
				displayName: "Total Volume",
				name: "totalVolume",
				type: "string",
				required: true,
				default: "0",
				description:
					"Total transaction volume in wei (as a string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},
			{
				displayName: "Transaction Count",
				name: "transactionCount",
				type: "number",
				required: true,
				default: 0,
				typeOptions: { minValue: 0 },
				description: "Total number of transactions the agent has completed",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},
			{
				displayName: "Success Rate (Basis Points)",
				name: "successRate",
				type: "number",
				required: true,
				default: 10000,
				typeOptions: { minValue: 0, maxValue: 10000 },
				description:
					"Transaction success rate in basis points (10000 = 100%, 9500 = 95%)",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},
			{
				displayName: "Daily Spent",
				name: "dailySpent",
				type: "string",
				required: true,
				default: "0",
				description: "Amount spent today in wei (string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},
			{
				displayName: "Daily Limit",
				name: "dailyLimit",
				type: "string",
				required: true,
				default: "0",
				description: "Daily budget limit in wei (string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},
			{
				displayName: "Account Age (Seconds)",
				name: "accountAgeSeconds",
				type: "number",
				required: true,
				default: 0,
				typeOptions: { minValue: 0 },
				description: "How long the agent account has existed, in seconds",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},
			{
				displayName: "Sanctions Clean",
				name: "sanctionsClean",
				type: "boolean",
				default: true,
				description:
					"Whether the agent has passed sanctions screening (true = clean)",
				displayOptions: {
					show: {
						resource: ["score"],
						operation: ["compute"],
					},
				},
			},

			// ------------------------------------------------------------------
			//  Transaction: Record
			// ------------------------------------------------------------------
			{
				displayName: "Agent Address",
				name: "agentAddress",
				type: "string",
				required: true,
				default: "",
				placeholder: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
				description: "The Ethereum address of the agent who performed the transaction",
				displayOptions: {
					show: {
						resource: ["transaction"],
						operation: ["record"],
					},
				},
			},
			{
				displayName: "Transaction Hash",
				name: "txHash",
				type: "string",
				required: true,
				default: "",
				placeholder: "0xabc123...",
				description: "The on-chain transaction hash (hex-encoded)",
				displayOptions: {
					show: {
						resource: ["transaction"],
						operation: ["record"],
					},
				},
			},
			{
				displayName: "Amount",
				name: "amount",
				type: "string",
				required: true,
				default: "0",
				description: "Transaction amount in wei (string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["transaction"],
						operation: ["record"],
					},
				},
			},
			{
				displayName: "Transaction Type",
				name: "txType",
				type: "options",
				required: true,
				options: [
					{ name: "Payment", value: 0 },
					{ name: "Transfer", value: 1 },
					{ name: "Swap", value: 2 },
					{ name: "Stake", value: 3 },
					{ name: "Other", value: 4 },
				],
				default: 0,
				description: "The category of this transaction",
				displayOptions: {
					show: {
						resource: ["transaction"],
						operation: ["record"],
					},
				},
			},

			// ------------------------------------------------------------------
			//  Budget: Set Limits
			// ------------------------------------------------------------------
			{
				displayName: "Daily Limit",
				name: "budgetDailyLimit",
				type: "string",
				required: true,
				default: "0",
				description:
					"Maximum amount the agent can spend per day, in wei (string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["budget"],
						operation: ["setLimits"],
					},
				},
			},
			{
				displayName: "Monthly Limit",
				name: "budgetMonthlyLimit",
				type: "string",
				required: true,
				default: "0",
				description:
					"Maximum amount the agent can spend per month, in wei (string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["budget"],
						operation: ["setLimits"],
					},
				},
			},
			{
				displayName: "Per-Transaction Limit",
				name: "budgetPerTxLimit",
				type: "string",
				required: true,
				default: "0",
				description:
					"Maximum amount allowed per individual transaction, in wei (string for BigInt precision)",
				displayOptions: {
					show: {
						resource: ["budget"],
						operation: ["setLimits"],
					},
				},
			},

			// ------------------------------------------------------------------
			//  Budget: Check
			// ------------------------------------------------------------------
			{
				displayName: "Amount",
				name: "checkAmount",
				type: "string",
				required: true,
				default: "0",
				description:
					"The amount in wei to check against the agent budget limits",
				displayOptions: {
					show: {
						resource: ["budget"],
						operation: ["check"],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter("resource", 0) as string;
		const operation = this.getNodeParameter("operation", 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject = {};

				// ---------------------------------------------------------------
				//  Agent
				// ---------------------------------------------------------------
				if (resource === "agent") {
					const address = this.getNodeParameter("agentAddress", i) as string;

					if (operation !== "register" && !isValidAddress(address)) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid Ethereum address: "${address}"`,
							{ itemIndex: i },
						);
					}

					if (operation === "getDetails") {
						responseData = await qovaApiRequest.call(
							this,
							"GET",
							`/api/agents/${address}`,
						);
					} else if (operation === "getScore") {
						responseData = await qovaApiRequest.call(
							this,
							"GET",
							`/api/agents/${address}/score`,
						);
					} else if (operation === "checkRegistration") {
						responseData = await qovaApiRequest.call(
							this,
							"GET",
							`/api/agents/${address}/registered`,
						);
					} else if (operation === "register") {
						if (!isValidAddress(address)) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid Ethereum address: "${address}"`,
								{ itemIndex: i },
							);
						}
						responseData = await qovaApiRequest.call(
							this,
							"POST",
							"/api/agents/register",
							{ agent: address },
						);
					} else if (operation === "updateScore") {
						const score = this.getNodeParameter("score", i) as number;
						const reason = this.getNodeParameter("reason", i) as string;
						responseData = await qovaApiRequest.call(
							this,
							"POST",
							`/api/agents/${address}/score`,
							{ score, reason },
						);
					}
				}

				// ---------------------------------------------------------------
				//  Score
				// ---------------------------------------------------------------
				if (resource === "score") {
					if (operation === "getBreakdown") {
						const address = this.getNodeParameter("agentAddress", i) as string;
						if (!isValidAddress(address)) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid Ethereum address: "${address}"`,
								{ itemIndex: i },
							);
						}
						responseData = await qovaApiRequest.call(
							this,
							"GET",
							`/api/scores/${address}`,
						);
					} else if (operation === "compute") {
						const body: IDataObject = {
							totalVolume: this.getNodeParameter("totalVolume", i) as string,
							transactionCount: this.getNodeParameter("transactionCount", i) as number,
							successRate: this.getNodeParameter("successRate", i) as number,
							dailySpent: this.getNodeParameter("dailySpent", i) as string,
							dailyLimit: this.getNodeParameter("dailyLimit", i) as string,
							accountAgeSeconds: this.getNodeParameter("accountAgeSeconds", i) as number,
							sanctionsClean: this.getNodeParameter("sanctionsClean", i) as boolean,
						};
						responseData = await qovaApiRequest.call(
							this,
							"POST",
							"/api/scores/compute",
							body,
						);
					}
				}

				// ---------------------------------------------------------------
				//  Transaction
				// ---------------------------------------------------------------
				if (resource === "transaction") {
					if (operation === "record") {
						const agent = this.getNodeParameter("agentAddress", i) as string;
						if (!isValidAddress(agent)) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid Ethereum address: "${agent}"`,
								{ itemIndex: i },
							);
						}
						const body: IDataObject = {
							agent,
							txHash: this.getNodeParameter("txHash", i) as string,
							amount: this.getNodeParameter("amount", i) as string,
							txType: this.getNodeParameter("txType", i) as number,
						};
						responseData = await qovaApiRequest.call(
							this,
							"POST",
							"/api/transactions/record",
							body,
						);
					}
				}

				// ---------------------------------------------------------------
				//  Budget
				// ---------------------------------------------------------------
				if (resource === "budget") {
					const address = this.getNodeParameter("agentAddress", i) as string;
					if (!isValidAddress(address)) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid Ethereum address: "${address}"`,
							{ itemIndex: i },
						);
					}

					if (operation === "getStatus") {
						responseData = await qovaApiRequest.call(
							this,
							"GET",
							`/api/budgets/${address}`,
						);
					} else if (operation === "setLimits") {
						const body: IDataObject = {
							dailyLimit: this.getNodeParameter("budgetDailyLimit", i) as string,
							monthlyLimit: this.getNodeParameter("budgetMonthlyLimit", i) as string,
							perTxLimit: this.getNodeParameter("budgetPerTxLimit", i) as string,
						};
						responseData = await qovaApiRequest.call(
							this,
							"POST",
							`/api/budgets/${address}/set`,
							body,
						);
					} else if (operation === "check") {
						const body: IDataObject = {
							amount: this.getNodeParameter("checkAmount", i) as string,
						};
						responseData = await qovaApiRequest.call(
							this,
							"POST",
							`/api/budgets/${address}/check`,
							body,
						);
					}
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error: unknown) {
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({
							error: error instanceof Error ? error.message : "Unknown error",
						}),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
