"use client"

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

export function HeaderWallet(): React.ReactElement {
  return (
    <Wallet>
      <ConnectWallet className="!rounded-md !border !border-border !bg-background !px-3 !py-1.5 !text-sm !font-medium !text-foreground !shadow-none hover:!bg-accent">
        <Avatar className="h-5 w-5" />
        <Name className="font-mono text-xs" />
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
