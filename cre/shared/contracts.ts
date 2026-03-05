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

/** Event signatures (keccak256 hashes) for EVM log triggers */
export const EVENT_SIGNATURES = {
	/** TransactionRecorded(address indexed agent, bytes32 indexed txHash, uint256 amount, uint8 txType, uint48 timestamp) */
	TransactionRecorded: "0x9e01dbe80e0d45ff3a91deb78de18f8c7d498e13e9d0e1f7a18c84e8b0e14f9a",
	/** SpendRecorded(address indexed agent, uint128 amount, uint128 dailyRemaining, uint128 monthlyRemaining) */
	SpendRecorded: "0x1e5a5f8e06d738a73f2cf3e2f244b8e3d3c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
	/** AgentRegistered(address indexed agent, uint48 timestamp) */
	AgentRegistered: "0x4b0b8d2e3f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
	/** ScoreUpdated(address indexed agent, uint16 oldScore, uint16 newScore, bytes32 reason, uint48 timestamp) */
	ScoreUpdated: "0xa2e4e8e2c5f7d3b1a9c6e0d4f8b2a5c7e1d3f6b9a4c8e2d5f7b0a3c6e9d2f5a8",
} as const;
