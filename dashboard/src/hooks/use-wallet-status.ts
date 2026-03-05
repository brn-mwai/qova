"use client"

import { useAccount, useBalance, useChainId } from "wagmi"
import { SUPPORTED_CHAINS, getChain, type ChainConfig } from "@/lib/chains"

interface WalletStatus {
	address: `0x${string}` | undefined
	isConnected: boolean
	isCorrectChain: boolean
	chainId: number | undefined
	needsChainSwitch: boolean
	currentChain: ChainConfig | undefined
	balanceFormatted: string | undefined
	balanceSymbol: string | undefined
}

const DISCONNECTED: WalletStatus = {
	address: undefined,
	isConnected: false,
	isCorrectChain: false,
	chainId: undefined,
	needsChainSwitch: false,
	currentChain: undefined,
	balanceFormatted: undefined,
	balanceSymbol: undefined,
}

const SUPPORTED_IDS = new Set(SUPPORTED_CHAINS.map((c) => c.id))

export function useWalletStatus(): WalletStatus {
	const { address, isConnected } = useAccount()
	const chainId = useChainId()
	const { data: balance } = useBalance({ address })

	if (!isConnected || !address) {
		return DISCONNECTED
	}

	const isCorrectChain = SUPPORTED_IDS.has(chainId)
	const currentChain = getChain(chainId)

	return {
		address,
		isConnected,
		isCorrectChain,
		chainId,
		needsChainSwitch: isConnected && !isCorrectChain,
		currentChain,
		balanceFormatted: balance?.formatted,
		balanceSymbol: balance?.symbol,
	}
}
