/**
 * @file shared/contracts.ts
 * Minimal ABI fragments for CRE workflow interactions.
 * Subsets of the full ABIs -- only the functions/events CRE needs.
 */

/** ReputationRegistry ABI -- read functions + write functions + events */
export const REPUTATION_REGISTRY_ABI = [
	{
		name: "getScore",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [{ name: "", type: "uint16" }],
	},
	{
		name: "getAgentDetails",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "score", type: "uint16" },
					{ name: "lastUpdated", type: "uint48" },
					{ name: "updateCount", type: "uint32" },
					{ name: "registered", type: "bool" },
				],
			},
		],
	},
	{
		name: "isRegistered",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [{ name: "", type: "bool" }],
	},
	{
		name: "updateScore",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "agent", type: "address" },
			{ name: "newScore", type: "uint16" },
			{ name: "reason", type: "bytes32" },
		],
		outputs: [],
	},
] as const;

/** TransactionValidator ABI -- read functions + events */
export const TRANSACTION_VALIDATOR_ABI = [
	{
		name: "getTransactionStats",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "totalCount", type: "uint64" },
					{ name: "totalVolume", type: "uint128" },
					{ name: "successCount", type: "uint64" },
					{ name: "lastActivityTimestamp", type: "uint48" },
				],
			},
		],
	},
	{
		name: "getSuccessRate",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [{ name: "", type: "uint256" }],
	},
] as const;

/** BudgetEnforcer ABI -- read functions */
export const BUDGET_ENFORCER_ABI = [
	{
		name: "getBudgetStatus",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [
			{
				name: "status",
				type: "tuple",
				components: [
					{ name: "dailyRemaining", type: "uint128" },
					{ name: "monthlyRemaining", type: "uint128" },
					{ name: "perTxLimit", type: "uint128" },
					{ name: "dailySpent", type: "uint128" },
					{ name: "monthlySpent", type: "uint128" },
				],
			},
		],
	},
	{
		name: "hasBudget",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [{ name: "", type: "bool" }],
	},
] as const;

/** QovaCore ABI -- facade read functions for aggregated agent data */
export const QOVA_CORE_ABI = [
	{
		name: "getAgentScore",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [{ name: "", type: "uint16" }],
	},
	{
		name: "getAgentStats",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "totalCount", type: "uint64" },
					{ name: "totalVolume", type: "uint128" },
					{ name: "successCount", type: "uint64" },
					{ name: "lastActivityTimestamp", type: "uint48" },
				],
			},
		],
	},
	{
		name: "getAgentBudgetStatus",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "dailyRemaining", type: "uint128" },
					{ name: "monthlyRemaining", type: "uint128" },
					{ name: "perTxLimit", type: "uint128" },
					{ name: "dailySpent", type: "uint128" },
					{ name: "monthlySpent", type: "uint128" },
				],
			},
		],
	},
] as const;

/** QovaReputationConsumer ABI -- CRE report receiver */
export const QOVA_REPUTATION_CONSUMER_ABI = [
	{
		name: "onReport",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [{ name: "reportPayload", type: "bytes" }],
		outputs: [],
	},
] as const;

/** Pre-computed event signature keccak256 hashes for EVM log triggers */
export const EVENT_SIGNATURES = {
	/** TransactionRecorded(address,bytes32,uint256,uint8,uint48) */
	TransactionRecorded: "0x2952dfbfd2e957df91fb3c0272c40addc5175ca07216e27021b1ea2b988aa161" as `0x${string}`,
	/** SpendRecorded(address,uint128,uint128,uint128) */
	SpendRecorded: "0x163877ff2ffa5bacbe5a23f942d0a130610b751c4e1ddae73e7f6f3f486f97c8" as `0x${string}`,
} as const;
