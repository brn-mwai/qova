"use client"

import { useQuery } from "convex/react"
import {
  Wallet as WalletIcon,
  Link as LinkIcon,
  ArrowSquareOut,
} from "@phosphor-icons/react"
import { api } from "../../../../../convex/_generated/api"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { ConnectWalletCard } from "@/components/wallet/connect-wallet"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/data/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getChain, DEFAULT_CHAIN_ID } from "@/lib/chains"

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1">{children}</div>
    </div>
  )
}

export default function WalletSettingsPage(): React.ReactElement {
  const available = useConvexAvailable()
  const user = useQuery(api.users.currentUser, available ? {} : "skip")
  const chain = getChain(DEFAULT_CHAIN_ID)

  return (
    <div className="px-4 lg:px-6">
      <div className="mx-auto max-w-3xl w-full space-y-6">
        <PageHeader
          breadcrumb="Settings / Wallet"
          title="Wallet"
          subtitle="Connect and manage your blockchain wallet"
          info={{
            description: "Connect your wallet and manage blockchain network settings for on-chain operations.",
            sections: [
              { title: "Wallet Connection", description: "Link your wallet via MetaMask, Coinbase Wallet, or other providers." },
              { title: "Network Configuration", description: "View the target blockchain network, chain ID, and block explorer URL." },
            ],
          }}
        />

        {/* Wallet Connection */}
        <ConnectWalletCard showSupportedWallets />

        {/* Linked Wallet (from Convex) */}
        {user?.walletAddress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <LinkIcon size={16} />
                Linked Wallet
              </CardTitle>
              <CardDescription>
                This wallet address is linked to your Qova account and used for on-chain operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingRow label="Address" description="Your linked wallet address">
                <span className="font-mono text-xs">
                  {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                </span>
              </SettingRow>
              <SettingRow label="Status" description="Account linkage status">
                <StatusBadge status="active" />
              </SettingRow>
              {chain && (
                <SettingRow label="Explorer" description="View on block explorer">
                  <a
                    href={`${chain.explorerUrl}/address/${user.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {chain.explorerLabel}
                    <ArrowSquareOut size={12} />
                  </a>
                </SettingRow>
              )}
            </CardContent>
          </Card>
        )}

        {/* Network Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <WalletIcon size={16} />
              Network Configuration
            </CardTitle>
            <CardDescription>
              Blockchain network used for Qova protocol operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow label="Chain" description="Target blockchain network">
              <span className="font-mono text-xs">{chain?.name ?? "Base Sepolia"}</span>
            </SettingRow>
            <SettingRow label="Chain ID" description="Numeric chain identifier">
              <span className="font-mono text-xs">{DEFAULT_CHAIN_ID}</span>
            </SettingRow>
            <SettingRow label="Type" description="Network environment">
              <span className="text-xs text-muted-foreground">
                {chain?.isTestnet ? "Testnet" : "Mainnet"}
              </span>
            </SettingRow>
            {chain && (
              <SettingRow label="Explorer" description="Block explorer for verification">
                <a
                  href={chain.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {chain.explorerLabel}
                  <ArrowSquareOut size={12} />
                </a>
              </SettingRow>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
