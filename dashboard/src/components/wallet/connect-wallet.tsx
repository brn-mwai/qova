"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi"
import { useMutation } from "convex/react"
import {
  Wallet as WalletIcon,
  CheckCircle,
  Copy,
  SignOut,
  SpinnerGap,
  Warning,
  MetaLogo,
  CurrencyBtc,
  Globe,
  Plugs,
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

/** Map connector IDs to friendly labels and icons */
function getConnectorInfo(id: string, name: string): { label: string; iconType: "metamask" | "coinbase" | "walletconnect" | "injected" } {
  const lower = id.toLowerCase()
  if (lower.includes("metamask") || name.toLowerCase().includes("metamask")) return { label: "MetaMask", iconType: "metamask" }
  if (lower.includes("coinbase") || name.toLowerCase().includes("coinbase")) return { label: "Coinbase Wallet", iconType: "coinbase" }
  if (lower.includes("walletconnect")) return { label: "WalletConnect", iconType: "walletconnect" }
  return { label: name || "Browser Wallet", iconType: "injected" }
}

function ConnectorIcon({ type, className }: { type: string; className?: string }): React.ReactElement {
  switch (type) {
    case "metamask":
      return <MetaLogo className={className} weight="fill" />
    case "coinbase":
      return <CurrencyBtc className={className} weight="fill" />
    case "walletconnect":
      return <Globe className={className} weight="fill" />
    default:
      return <Plugs className={className} weight="fill" />
  }
}

interface ConnectWalletCardProps {
  onConnected?: (address: string) => void
  compact?: boolean
  showSupportedWallets?: boolean
}

export function ConnectWalletCard({
  onConnected,
  compact = false,
  showSupportedWallets = false,
}: ConnectWalletCardProps): React.ReactElement {
  const { address, isConnected, connector: activeConnector } = useAccount()
  const { data: balance } = useBalance({ address })
  const { connectors, connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const available = useConvexAvailable()
  const linkWallet = useMutation(api.mutations.users.linkWallet)

  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  const chain = getChain(DEFAULT_CHAIN_ID)

  // Deduplicate connectors by name (wagmi can register duplicates)
  const seen = new Set<string>()
  const uniqueConnectors = connectors.filter((c) => {
    const label = getConnectorInfo(c.id, c.name).label
    if (seen.has(label)) return false
    seen.add(label)
    return true
  })

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

  const handleConnect = useCallback((connector: (typeof connectors)[number]): void => {
    setConnectingId(connector.id)
    connect(
      { connector },
      { onSettled: () => setConnectingId(null) },
    )
  }, [connect])

  // Compact mode
  if (compact) {
    if (!isConnected) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => uniqueConnectors[0] && handleConnect(uniqueConnectors[0])}
          disabled={isConnecting}
          className="gap-2"
        >
          <WalletIcon className="size-4" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
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

  // Full card - not connected
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
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            {uniqueConnectors.map((connector) => {
              const info = getConnectorInfo(connector.id, connector.name)
              const isLoading = connectingId === connector.id
              return (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => handleConnect(connector)}
                  disabled={isConnecting}
                  className="flex items-center gap-3 border px-4 py-3 text-left hover:bg-accent/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  <div className="flex size-8 items-center justify-center bg-muted shrink-0">
                    {isLoading ? (
                      <SpinnerGap size={16} className="animate-spin text-muted-foreground" />
                    ) : (
                      <ConnectorIcon type={info.iconType} className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {info.iconType === "metamask" && "Browser extension or mobile app"}
                      {info.iconType === "coinbase" && "Coinbase Wallet or Smart Wallet"}
                      {info.iconType === "walletconnect" && "Scan QR code with any wallet"}
                      {info.iconType === "injected" && "Use your browser's built-in wallet"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {showSupportedWallets && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Supports MetaMask, Coinbase Wallet, WalletConnect, and any injected browser wallet.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Full card - connected
  const activeInfo = activeConnector ? getConnectorInfo(activeConnector.id, activeConnector.name) : null

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
          {activeInfo ? `Connected via ${activeInfo.label}` : "Your wallet is connected"}{chain ? ` on ${chain.name}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address */}
        <div className="flex items-center justify-between border bg-muted/30 p-3">
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
          <div className="border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Balance
            </p>
            <p className="font-mono text-sm">
              {balance
                ? `${Number.parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}`
                : "Loading..."}
            </p>
          </div>
          <div className="border bg-muted/30 p-3 space-y-1">
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
