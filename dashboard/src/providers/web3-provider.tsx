"use client"

import { OnchainKitProvider } from "@coinbase/onchainkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { type State, WagmiProvider, createConfig, http } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors"
import { type Chain } from "viem"

const CDP_API_KEY = process.env.NEXT_PUBLIC_CDP_API_KEY ?? ""
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ""

const skaleBase: Chain = {
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
}

const connectors = [
  injected(),
  metaMask(),
  coinbaseWallet({
    appName: "Qova Protocol",
    preference: "all",
  }),
  ...(WALLETCONNECT_PROJECT_ID
    ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })]
    : []),
]

export const wagmiConfig = createConfig({
  chains: [skaleBase, base, baseSepolia],
  connectors,
  ssr: true,
  transports: {
    [skaleBase.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})

interface Web3ProviderProps {
  children: ReactNode
  initialState?: State
}

export function Web3Provider({ children, initialState }: Web3ProviderProps): React.ReactElement {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={CDP_API_KEY}
          chain={skaleBase}
          config={{
            appearance: {
              mode: "auto",
            },
          }}
          projectId={WALLETCONNECT_PROJECT_ID || undefined}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
