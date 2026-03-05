"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount, useBalance, useDisconnect } from "wagmi"
import { useMutation } from "convex/react"
import {
  Wallet,
  ConnectWallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet"
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity"
import {
  Wallet as WalletIcon,
  CheckCircle,
  Copy,
  SignOut,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react"
import { api } from "../../../convex/_generated/api"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getChain, DEFAULT_CHAIN_ID } from "@/lib/chains"

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

interface ConnectWalletCardProps {
  /** Called after wallet is linked to Convex user */
  onConnected?: (address: string) => void
  /** Whether to show as a compact inline element vs full card */
  compact?: boolean
  /** Show supported wallets info */
  showSupportedWallets?: boolean
}

/**
 * Full wallet connection card with Convex linkWallet integration.
 * Shows connection state, balance, chain info, and copy address button.
 */
export function ConnectWalletCard({
  onConnected,
  compact = false,
  showSupportedWallets = false,
}: ConnectWalletCardProps): React.ReactElement {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const { disconnect } = useDisconnect()
  const available = useConvexAvailable()
  const linkWallet = useMutation(api.mutations.users.linkWallet)

  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const chain = getChain(DEFAULT_CHAIN_ID)

  // Link wallet to Convex user when connected
  const handleLinkWallet = useCallback(async (): Promise<void> => {
    if (!address || !available) return
    setLinking(true)
    setLinkError(null)
    try {
      await linkWallet({ walletAddress: address })
      setLinked(true)
      onConnected?.(address)
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link wallet")
    } finally {
      setLinking(false)
    }
  }, [address, available, linkWallet, onConnected])

  // Auto-link on connect
  useEffect(() => {
    if (isConnected && address && available && !linked && !linking) {
      handleLinkWallet()
    }
  }, [isConnected, address, available, linked, linking, handleLinkWallet])

  const handleCopy = useCallback((): void => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  const handleDisconnect = useCallback((): void => {
    disconnect()
    setLinked(false)
    setLinkError(null)
  }, [disconnect])

  if (compact) {
    if (!isConnected) {
      return (
        <Wallet>
          <ConnectWallet className="!inline-flex !items-center !gap-2 !rounded-md !border !border-border !bg-background !px-4 !py-2 !text-sm !font-medium !text-foreground !shadow-none hover:!bg-accent">
            <WalletIcon className="size-4" />
            <span>Connect Wallet</span>
          </ConnectWallet>
        </Wallet>
      )
    }

    return (
      <div className="inline-flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 font-mono text-xs">
          <span className="size-2 rounded-full bg-[var(--score-green)]" />
          {truncateAddress(address ?? "")}
        </Badge>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="size-8 p-0">
          {copied ? <CheckCircle size={14} className="text-[var(--score-green)]" /> : <Copy size={14} />}
        </Button>
      </div>
    )
  }

  // Full card mode
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <WalletIcon size={16} />
            Connect Wallet
          </CardTitle>
          <CardDescription>
            Link a wallet to your Qova account for on-chain verification and transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Wallet>
            <ConnectWallet className="!flex !items-center !justify-center !gap-2 !w-full !rounded-md !border !border-border !bg-foreground !px-4 !py-2.5 !text-sm !font-medium !text-background !shadow-none hover:!bg-foreground/90">
              <WalletIcon className="size-4" />
              <span>Connect Wallet</span>
            </ConnectWallet>
          </Wallet>

          {showSupportedWallets && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Supported wallets</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px]">Coinbase Smart Wallet</Badge>
                <Badge variant="outline" className="text-[10px]">Coinbase Wallet</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <WalletIcon size={16} />
          Wallet Connected
          {linked && (
            <CheckCircle size={14} weight="fill" className="text-[var(--score-green)]" />
          )}
        </CardTitle>
        <CardDescription>
          Your wallet is connected{chain ? ` on ${chain.name}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Address
            </p>
            <p className="font-mono text-sm">{truncateAddress(address ?? "")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="size-8 p-0">
            {copied ? (
              <CheckCircle size={14} className="text-[var(--score-green)]" />
            ) : (
              <Copy size={14} />
            )}
          </Button>
        </div>

        {/* Balance & Chain */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Balance
            </p>
            <p className="font-mono text-sm">
              {balance
                ? `${Number.parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}`
                : "Loading..."}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Network
            </p>
            <p className="text-sm">{chain?.name ?? "Unknown"}</p>
          </div>
        </div>

        {/* Link status */}
        {linking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerGap size={14} className="animate-spin" />
            Linking wallet to your account...
          </div>
        )}
        {linkError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <Warning size={14} />
            {linkError}
          </div>
        )}

        {/* Disconnect */}
        <Button variant="outline" size="sm" onClick={handleDisconnect} className="gap-2">
          <SignOut size={14} />
          Disconnect
        </Button>
      </CardContent>
    </Card>
  )
}
