/**
 * Read on-chain state for registered demo agents.
 * Usage: cd contracts && bun run scripts/check-agents.ts
 */

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
	chain: baseSepolia,
	transport: http("https://sepolia.base.org"),
});

const registryAbi = [
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
] as const;

const validatorAbi = [
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

const enforcerAbi = [
	{
		name: "getBudgetStatus",
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

const REGISTRY = "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB" as `0x${string}`;
const VALIDATOR = "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900" as `0x${string}`;
const ENFORCER = "0x271618781040dc358e4F6B66561b65A839b0C76E" as `0x${string}`;

const agents: Array<{ name: string; addr: `0x${string}` }> = [
	{ name: "Wispy Agent (SKALE)", addr: "0xcf6B036F5B201eEc1f3c3e9C08A0b0Ee8B30C32A" },
	{ name: "Qova Deployer Agent", addr: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158" },
];

for (const a of agents) {
	const details = await client.readContract({
		address: REGISTRY,
		abi: registryAbi,
		functionName: "getAgentDetails",
		args: [a.addr],
	});
	const stats = await client.readContract({
		address: VALIDATOR,
		abi: validatorAbi,
		functionName: "getTransactionStats",
		args: [a.addr],
	});
	const rate = await client.readContract({
		address: VALIDATOR,
		abi: validatorAbi,
		functionName: "getSuccessRate",
		args: [a.addr],
	});
	const budget = await client.readContract({
		address: ENFORCER,
		abi: enforcerAbi,
		functionName: "getBudgetStatus",
		args: [a.addr],
	});

	console.log(`\n=== ${a.name} ===`);
	console.log(`Score: ${details.score} | Registered: ${details.registered} | Updates: ${details.updateCount}`);
	console.log(
		`Transactions: ${stats.totalCount} | Volume: ${(Number(stats.totalVolume) / 1e18).toFixed(2)} ETH | Success rate: ${(Number(rate) / 100).toFixed(1)}%`,
	);
	console.log(
		`Budget - Daily spent: ${(Number(budget.dailySpent) / 1e18).toFixed(2)} ETH | Monthly spent: ${(Number(budget.monthlySpent) / 1e18).toFixed(2)} ETH | Per-tx limit: ${(Number(budget.perTxLimit) / 1e18).toFixed(1)} ETH`,
	);
	console.log(
		`Remaining - Daily: ${(Number(budget.dailyRemaining) / 1e18).toFixed(2)} ETH | Monthly: ${(Number(budget.monthlyRemaining) / 1e18).toFixed(2)} ETH`,
	);
}
