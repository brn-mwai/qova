"use client"

import { useState } from "react"
import { Copy, Check } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface AddressDisplayProps {
  address: string
  truncate?: boolean
  className?: string
}

export function AddressDisplay({
  address,
  truncate = true,
  className,
}: AddressDisplayProps): React.ReactElement {
  const [copied, setCopied] = useState(false)

  const displayAddress = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  function handleCopy(): void {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "group/addr inline-flex items-center gap-1.5 font-mono text-[13px] text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
      title={`Click to copy: ${address}`}
    >
      {displayAddress}
      {copied ? (
        <Check className="size-3.5 text-score-green" />
      ) : (
        <Copy className="size-3.5 opacity-0 group-hover/addr:opacity-100 transition-opacity" />
      )}
    </button>
  )
}
