"use client"

import { Wallet as WalletIcon } from "@phosphor-icons/react"
import { useWalletStatus } from "@/hooks/use-wallet-status"
import {
  ConnectWallet,
  Wallet,
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

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function SidebarWallet(): React.ReactElement {
  const { isConnected, address, currentChain } = useWalletStatus()

  if (!isConnected) {
    return (
      <Wallet>
        <ConnectWallet className="!flex !items-center !gap-2 !w-full !px-3 !py-2 !text-sm !text-[var(--text-secondary)] hover:!bg-[var(--bg-sidebar-active)] !rounded-none !transition-colors !bg-transparent !border-none !shadow-none">
          <WalletIcon className="size-4" />
          <span>Connect Wallet</span>
        </ConnectWallet>
      </Wallet>
    )
  }

  return (
    <Wallet>
      <ConnectWallet className="!flex !items-center !gap-2 !w-full !px-3 !py-1.5 hover:!bg-[var(--bg-sidebar-active)] !rounded-none !transition-colors !bg-transparent !border-none !shadow-none">
        <span className="size-2 rounded-full bg-[var(--status-green-text)] shrink-0" />
        <span className="text-xs font-mono text-[var(--text-secondary)] truncate">
          {address ? truncateAddress(address) : ""}
        </span>
        {currentChain && (
          <span className="text-[10px] text-[var(--text-tertiary)] ml-auto shrink-0">
            {currentChain.name}
          </span>
        )}
      </ConnectWallet>
      <WalletDropdown>
        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
          <Avatar />
          <Name className="font-medium" />
          <Address className="font-mono text-xs text-muted-foreground" />
          <EthBalance className="font-mono text-xs" />
        </Identity>
        <WalletDropdownDisconnect />
      </WalletDropdown>
    </Wallet>
  )
}
