/**
 * SDK client singleton -- initializes @brnmwai/qova-core client for API use.
 * @author Qova Engineering <eng@qova.cc>
 */

/**
 * SDK client singleton -- initializes @brnmwai/qova-core client for API use.
 * Supports multiple chains (Base Sepolia, Base Mainnet, SKALE Base).
 * @author Qova Engineering <eng@qova.cc>
 */

import { createQovaClient, type QovaClient } from "@brnmwai/qova-core";
import { createWalletClient, http, type Chain as ViemChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import type { Chain } from "@brnmwai/qova-core";

/** SKALE Base L3 chain config for viem. */
const skaleBase: ViemChain = {
	id: 1187947933,
	name: "SKALE Base",
	nativeCurrency: { name: "CREDIT", symbol: "CREDIT", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://skale-base.skalenodes.com/v1/base"] },
	},
	blockExplorers: {
		default: {
			name: "SKALE Base Explorer",
			url: "https://skale-base-explorer.skalenodes.com",
		},
	},
};

const CHAIN_CONFIGS: Record<string, { viemChain: ViemChain; defaultRpc: string }> = {
	"base-sepolia": { viemChain: baseSepolia, defaultRpc: "https://sepolia.base.org" },
	base: { viemChain: base, defaultRpc: "https://mainnet.base.org" },
	"skale-base": {
		viemChain: skaleBase,
		defaultRpc: "https://skale-base.skalenodes.com/v1/base",
	},
};

/** Cached client instances per chain. */
const clients = new Map<string, QovaClient>();

/**
 * Get or create the Qova SDK client for a given chain.
 * Defaults to base-sepolia if no chain specified.
 * @param chain - The chain identifier.
 * @returns The QovaClient instance.
 */
export function getQovaClient(chain?: string): QovaClient {
	const chainName = chain ?? "base-sepolia";

	const cached = clients.get(chainName);
	if (cached) return cached;

	const chainConfig = CHAIN_CONFIGS[chainName];
	if (!chainConfig) {
		throw new Error(`Unsupported chain: ${chainName}`);
	}

	const rpcUrl = process.env.RPC_URL || chainConfig.defaultRpc;
	const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

	const config: Parameters<typeof createQovaClient>[0] = {
		chain: chainName as Chain,
		rpcUrl,
	};

	if (privateKey) {
		const account = privateKeyToAccount(privateKey as `0x${string}`);
		const walletClient = createWalletClient({
			account,
			chain: chainConfig.viemChain,
			transport: http(rpcUrl),
		});
		config.walletClient = walletClient;
	}

	const client = createQovaClient(config);
	clients.set(chainName, client);
	return client;
}

/**
 * Reset all client singletons. For testing only.
 */
export function resetClient(): void {
	clients.clear();
}
