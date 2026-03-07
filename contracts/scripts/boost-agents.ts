/**
 * Record additional transactions on-chain to boost agent scores.
 * This simulates real agent activity over time so the CRE scoring
 * pipeline produces higher, more realistic scores.
 *
 * Usage: cd contracts && bun run scripts/boost-agents.ts
 */

import { createWalletClient, createPublicClient, http, parseEther, keccak256, toHex } from "viem";
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
const REGISTRY = "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB" as `0x${string}`;
const VALIDATOR = "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900" as `0x${string}`;
const ENFORCER = "0x271618781040dc358e4F6B66561b65A839b0C76E" as `0x${string}`;

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

const registryAbi = [
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

// ── Setup ───────────────────────────────────────────────────────────────
const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });

function randomBytes32(): `0x${string}` {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

async function waitForTx(hash: `0x${string}`, label: string): Promise<boolean> {
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status === "success") {
		console.log(`  [OK] ${label}`);
		return true;
	}
	console.error(`  [FAIL] ${label} - tx: ${hash}`);
	return false;
}

// ── Additional transactions to record ───────────────────────────────────
// These simulate weeks of real agent activity
const BOOST_DATA = [
	{
		address: "0xcf6B036F5B201eEc1f3c3e9C08A0b0Ee8B30C32A" as `0x${string}`,
		name: "Wispy Agent (SKALE)",
		transactions: [
			// Batch 2: More diverse activity
			{ amount: parseEther("3.5"), type: 0 },   // Large payment
			{ amount: parseEther("1.8"), type: 1 },   // Swap
			{ amount: parseEther("0.75"), type: 2 },   // Transfer
			{ amount: parseEther("2.2"), type: 0 },   // Payment
			{ amount: parseEther("4.0"), type: 3 },   // Contract call
			{ amount: parseEther("1.1"), type: 0 },   // Payment
			{ amount: parseEther("0.6"), type: 4 },   // Bridge
			{ amount: parseEther("2.8"), type: 1 },   // Swap
			{ amount: parseEther("1.5"), type: 0 },   // Payment
			{ amount: parseEther("0.9"), type: 2 },   // Transfer
			// Batch 3: High-value operations
			{ amount: parseEther("5.0"), type: 3 },   // Contract call
			{ amount: parseEther("3.2"), type: 0 },   // Payment
			{ amount: parseEther("1.7"), type: 1 },   // Swap
			{ amount: parseEther("2.5"), type: 0 },   // Payment
			{ amount: parseEther("0.4"), type: 2 },   // Transfer
			{ amount: parseEther("1.3"), type: 0 },   // Payment
			{ amount: parseEther("4.5"), type: 4 },   // Bridge
			{ amount: parseEther("2.0"), type: 1 },   // Swap
			{ amount: parseEther("0.85"), type: 0 },   // Payment
			{ amount: parseEther("3.1"), type: 3 },   // Contract call
			// Batch 4: Consistent smaller payments (shows reliability)
			{ amount: parseEther("0.5"), type: 0 },
			{ amount: parseEther("0.5"), type: 0 },
			{ amount: parseEther("0.5"), type: 0 },
			{ amount: parseEther("0.5"), type: 0 },
			{ amount: parseEther("0.5"), type: 0 },
			{ amount: parseEther("0.75"), type: 2 },
			{ amount: parseEther("0.75"), type: 2 },
			{ amount: parseEther("1.0"), type: 1 },
			{ amount: parseEther("1.0"), type: 1 },
			{ amount: parseEther("1.5"), type: 3 },
		],
		additionalSpend: parseEther("0.5"), // Small additional spend to keep budget healthy
	},
	{
		address: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158" as `0x${string}`,
		name: "Qova Deployer Agent",
		transactions: [
			// Batch 2: Enterprise-level operations
			{ amount: parseEther("5.0"), type: 0 },   // Large payment
			{ amount: parseEther("3.5"), type: 3 },   // Contract call
			{ amount: parseEther("2.0"), type: 1 },   // Swap
			{ amount: parseEther("4.2"), type: 0 },   // Payment
			{ amount: parseEther("1.5"), type: 2 },   // Transfer
			{ amount: parseEther("6.0"), type: 3 },   // Large contract call
			{ amount: parseEther("2.8"), type: 0 },   // Payment
			{ amount: parseEther("1.2"), type: 4 },   // Bridge
			{ amount: parseEther("3.0"), type: 1 },   // Swap
			{ amount: parseEther("2.5"), type: 0 },   // Payment
			// Batch 3: More volume
			{ amount: parseEther("7.5"), type: 3 },   // Big contract call
			{ amount: parseEther("4.0"), type: 0 },   // Payment
			{ amount: parseEther("2.2"), type: 1 },   // Swap
			{ amount: parseEther("3.8"), type: 0 },   // Payment
			{ amount: parseEther("1.0"), type: 2 },   // Transfer
			{ amount: parseEther("5.5"), type: 3 },   // Contract call
			{ amount: parseEther("2.0"), type: 4 },   // Bridge
			{ amount: parseEther("3.3"), type: 0 },   // Payment
			{ amount: parseEther("1.8"), type: 1 },   // Swap
			{ amount: parseEther("4.5"), type: 0 },   // Payment
			// Batch 4: Steady state
			{ amount: parseEther("1.0"), type: 0 },
			{ amount: parseEther("1.0"), type: 0 },
			{ amount: parseEther("1.0"), type: 0 },
			{ amount: parseEther("1.5"), type: 1 },
			{ amount: parseEther("1.5"), type: 1 },
			{ amount: parseEther("2.0"), type: 3 },
			{ amount: parseEther("2.0"), type: 3 },
			{ amount: parseEther("0.8"), type: 2 },
			{ amount: parseEther("0.8"), type: 2 },
			{ amount: parseEther("3.0"), type: 0 },
		],
		additionalSpend: parseEther("1.0"),
	},
];

// ── Main ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	console.log("=== Boosting Agent Activity (Base Sepolia) ===");
	console.log(`Deployer: ${account.address}\n`);

	const balance = await publicClient.getBalance({ address: account.address });
	console.log(`Balance: ${(Number(balance) / 1e18).toFixed(4)} ETH\n`);

	for (const agent of BOOST_DATA) {
		console.log(`\n--- ${agent.name} (${agent.address.slice(0, 10)}...) ---`);
		console.log(`Recording ${agent.transactions.length} additional transactions...`);

		let successCount = 0;
		for (let i = 0; i < agent.transactions.length; i++) {
			const tx = agent.transactions[i];
			try {
				const hash = await walletClient.writeContract({
					address: VALIDATOR,
					abi: validatorAbi,
					functionName: "recordTransaction",
					args: [agent.address, randomBytes32(), tx.amount, tx.type],
				});
				const ok = await waitForTx(hash, `Tx ${i + 1}/${agent.transactions.length} (${(Number(tx.amount) / 1e18).toFixed(2)} ETH, type ${tx.type})`);
				if (ok) successCount++;
			} catch (err) {
				console.error(`  [ERR] Tx ${i + 1}: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`);
			}
		}
		console.log(`  Recorded ${successCount}/${agent.transactions.length} transactions`);

		// Record additional spend
		try {
			const hash = await walletClient.writeContract({
				address: ENFORCER,
				abi: enforcerAbi,
				functionName: "recordSpend",
				args: [agent.address, agent.additionalSpend],
			});
			await waitForTx(hash, `Additional spend: ${(Number(agent.additionalSpend) / 1e18).toFixed(2)} ETH`);
		} catch (err) {
			console.error(`  [ERR] Spend: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`);
		}
	}

	console.log("\n=== Boost complete ===");
	console.log("Run CRE scoring to see updated scores:");
	console.log('  curl -X POST https://app.qova.cc/api/cre/execute -H "Content-Type: application/json" -d \'{"agentAddress":"0xcf6B036F5B201eEc1f3c3e9C08A0b0Ee8B30C32A"}\'');
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
