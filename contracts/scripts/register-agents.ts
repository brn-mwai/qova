/**
 * Register demo agents on-chain (Base Sepolia) and seed transaction + budget data.
 *
 * Usage:
 *   cd contracts && bun run scripts/register-agents.ts
 *
 * Requires DEPLOYER_PRIVATE_KEY in contracts/.env
 */

import { createWalletClient, createPublicClient, http, parseEther, encodeAbiParameters, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load env ────────────────────────────────────────────────────────────
const envPath = resolve(import.meta.dir, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#")) continue;
	const [key, ...rest] = trimmed.split("=");
	envVars[key] = rest.join("=");
}

const privateKey = envVars.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
	console.error("DEPLOYER_PRIVATE_KEY not set in contracts/.env");
	process.exit(1);
}

const rpcUrl = envVars.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// ── Contracts ───────────────────────────────────────────────────────────
const CONTRACTS = {
	ReputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB" as `0x${string}`,
	TransactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900" as `0x${string}`,
	BudgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E" as `0x${string}`,
	QovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a" as `0x${string}`,
};

// ── ABIs (minimal) ──────────────────────────────────────────────────────
const registryAbi = [
	{
		name: "registerAgent",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [],
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
	{
		name: "isRegistered",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "agent", type: "address" }],
		outputs: [{ name: "", type: "bool" }],
	},
] as const;

const validatorAbi = [
	{
		name: "recordTransaction",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "agent", type: "address" },
			{ name: "txHash", type: "bytes32" },
			{ name: "amount", type: "uint256" },
			{ name: "txType", type: "uint8" },
		],
		outputs: [],
	},
] as const;

const enforcerAbi = [
	{
		name: "setBudget",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "agent", type: "address" },
			{ name: "dailyLimit", type: "uint128" },
			{ name: "monthlyLimit", type: "uint128" },
			{ name: "perTxLimit", type: "uint128" },
		],
		outputs: [],
	},
	{
		name: "recordSpend",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "agent", type: "address" },
			{ name: "amount", type: "uint128" },
		],
		outputs: [],
	},
] as const;

// ── Demo Agents ─────────────────────────────────────────────────────────
// Real agent addresses to register on-chain
const DEMO_AGENTS = [
	{
		address: "0xcf6B036F5B201eEc1f3c3e9C08A0b0Ee8B30C32A" as `0x${string}`,
		name: "Wispy Agent (SKALE)",
		initialScore: 720,
		transactions: [
			{ amount: parseEther("0.5"), type: 0 },   // Payment
			{ amount: parseEther("1.2"), type: 2 },   // Transfer
			{ amount: parseEther("0.3"), type: 0 },   // Payment
			{ amount: parseEther("2.0"), type: 1 },   // Swap
			{ amount: parseEther("0.8"), type: 0 },   // Payment
			{ amount: parseEther("0.15"), type: 2 },  // Transfer
			{ amount: parseEther("1.5"), type: 3 },   // Contract Call
			{ amount: parseEther("0.45"), type: 0 },  // Payment
		],
		budget: {
			daily: parseEther("5"),
			monthly: parseEther("50"),
			perTx: parseEther("3"),
		},
		spend: parseEther("2.1"),
	},
	{
		address: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158" as `0x${string}`,
		name: "Qova Deployer Agent",
		initialScore: 850,
		transactions: [
			{ amount: parseEther("3.0"), type: 0 },   // Payment
			{ amount: parseEther("1.0"), type: 1 },   // Swap
			{ amount: parseEther("2.5"), type: 2 },   // Transfer
			{ amount: parseEther("0.75"), type: 0 },  // Payment
			{ amount: parseEther("4.2"), type: 3 },   // Contract Call
			{ amount: parseEther("1.8"), type: 0 },   // Payment
			{ amount: parseEther("0.5"), type: 4 },   // Bridge
			{ amount: parseEther("2.0"), type: 1 },   // Swap
			{ amount: parseEther("1.1"), type: 0 },   // Payment
			{ amount: parseEther("0.9"), type: 2 },   // Transfer
		],
		budget: {
			daily: parseEther("10"),
			monthly: parseEther("100"),
			perTx: parseEther("5"),
		},
		spend: parseEther("4.5"),
	},
];

// ── Setup clients ───────────────────────────────────────────────────────
const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`);

const publicClient = createPublicClient({
	chain: baseSepolia,
	transport: http(rpcUrl),
});

const walletClient = createWalletClient({
	account,
	chain: baseSepolia,
	transport: http(rpcUrl),
});

// ── Helpers ─────────────────────────────────────────────────────────────
function randomBytes32(): `0x${string}` {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

async function waitForTx(hash: `0x${string}`, label: string): Promise<void> {
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status === "success") {
		console.log(`  [OK] ${label} - tx: ${hash.slice(0, 10)}...`);
	} else {
		console.error(`  [FAIL] ${label} - tx: ${hash}`);
	}
}

// ── Main ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	console.log("=== Qova Demo Agent Registration (Base Sepolia) ===");
	console.log(`Deployer: ${account.address}`);
	console.log(`RPC: ${rpcUrl}\n`);

	const balance = await publicClient.getBalance({ address: account.address });
	console.log(`Balance: ${Number(balance) / 1e18} ETH\n`);

	if (balance === 0n) {
		console.error("No ETH balance. Fund the deployer on Base Sepolia first.");
		console.error("Faucet: https://www.alchemy.com/faucets/base-sepolia");
		process.exit(1);
	}

	for (const agent of DEMO_AGENTS) {
		console.log(`\n--- ${agent.name} (${agent.address.slice(0, 10)}...) ---`);

		// 1. Check if already registered
		const isRegistered = await publicClient.readContract({
			address: CONTRACTS.ReputationRegistry,
			abi: registryAbi,
			functionName: "isRegistered",
			args: [agent.address],
		});

		// 2. Register agent
		if (!isRegistered) {
			const hash = await walletClient.writeContract({
				address: CONTRACTS.ReputationRegistry,
				abi: registryAbi,
				functionName: "registerAgent",
				args: [agent.address],
			});
			await waitForTx(hash, "Register agent");
		} else {
			console.log("  [SKIP] Already registered");
		}

		// 3. Set initial score
		const reasonHash = keccak256(toHex("cre-reputation-oracle"));
		const scoreHash = await walletClient.writeContract({
			address: CONTRACTS.ReputationRegistry,
			abi: registryAbi,
			functionName: "updateScore",
			args: [agent.address, agent.initialScore, reasonHash],
		});
		await waitForTx(scoreHash, `Set score to ${agent.initialScore}`);

		// 4. Record transactions
		console.log(`  Recording ${agent.transactions.length} transactions...`);
		for (let i = 0; i < agent.transactions.length; i++) {
			const tx = agent.transactions[i];
			const txHashBytes = randomBytes32();
			const hash = await walletClient.writeContract({
				address: CONTRACTS.TransactionValidator,
				abi: validatorAbi,
				functionName: "recordTransaction",
				args: [agent.address, txHashBytes, tx.amount, tx.type],
			});
			await waitForTx(hash, `Tx ${i + 1}/${agent.transactions.length} (${Number(tx.amount) / 1e18} ETH)`);
		}

		// 5. Set budget
		const budgetHash = await walletClient.writeContract({
			address: CONTRACTS.BudgetEnforcer,
			abi: enforcerAbi,
			functionName: "setBudget",
			args: [agent.address, agent.budget.daily, agent.budget.monthly, agent.budget.perTx],
		});
		await waitForTx(budgetHash, `Budget: daily=${Number(agent.budget.daily) / 1e18}, monthly=${Number(agent.budget.monthly) / 1e18}, perTx=${Number(agent.budget.perTx) / 1e18}`);

		// 6. Record some spend against budget
		const spendHash = await walletClient.writeContract({
			address: CONTRACTS.BudgetEnforcer,
			abi: enforcerAbi,
			functionName: "recordSpend",
			args: [agent.address, agent.spend],
		});
		await waitForTx(spendHash, `Recorded spend: ${Number(agent.spend) / 1e18} ETH`);
	}

	console.log("\n=== Registration complete ===");
	console.log("\nVerify on Basescan:");
	for (const agent of DEMO_AGENTS) {
		console.log(`  ${agent.name}: https://sepolia.basescan.org/address/${agent.address}`);
	}
	console.log(`\nReputationRegistry: https://sepolia.basescan.org/address/${CONTRACTS.ReputationRegistry}`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
