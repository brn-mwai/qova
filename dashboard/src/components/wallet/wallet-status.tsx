"use client"

import { Wallet as WalletIcon, LinkBreak, CircleNotch } from "@phosphor-icons/react"
import { useWalletStatus } from "@/hooks/use-wallet-status"
import { Badge } from "@/components/ui/badge"

/**
 * Compact wallet status indicator for sidebar or header.
 * Shows connected state with chain badge, address, and balance.
 */
export function WalletStatusBadge(): React.ReactElement {
  const { isConnected, address, currentChain, balanceFormatted, balanceSymbol, needsChainSwitch } =
    useWalletStatus()

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LinkBreak size={14} />
        <span>No wallet</span>
      </div>
    )
  }

  if (needsChainSwitch) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <CircleNotch size={14} className="animate-spin" />
        <span>Wrong network</span>
      </div>
    )
  }

  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""
  const displayBalance = balanceFormatted
    ? `${Number.parseFloat(balanceFormatted).toFixed(4)} ${balanceSymbol ?? "ETH"}`
    : null

  return (
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-[var(--score-green)] shrink-0" />
      <span className="font-mono text-xs text-foreground">{displayAddress}</span>
      {currentChain && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {currentChain.name}
        </Badge>
      )}
      {displayBalance && (
        <span className="font-mono text-[10px] text-muted-foreground ml-auto">
          {displayBalance}
        </span>
      )}
    </div>
  )
}
