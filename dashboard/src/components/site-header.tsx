"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, MagnifyingGlass } from "@phosphor-icons/react"
import { ChainSelector } from "@/components/chain-selector"
import { useChainFilter } from "@/components/providers/chain-provider"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Button } from "@/components/ui/button"
import { HeaderWallet } from "@/components/header-wallet"

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/agents": "Agents",
  "/transactions": "Transactions",
  "/cre": "CRE Engine",
  "/ecosystem": "Ecosystem",
  "/scores": "Scores",
  "/budgets": "Budgets",
  "/verify": "Verify",
  "/integrations": "Integrations",
  "/alerts": "Alerts",
  "/developers/keys": "API Keys",
  "/developers/webhooks": "Webhooks",
  "/developers/docs": "API Docs",
  "/settings": "Settings",
  "/settings/team": "Team",
  "/settings/wallet": "Wallet",
  "/settings/notifications": "Notifications",
  "/onboarding": "Welcome",
}

function SearchTrigger(): React.ReactElement {
  function handleClick(): void {
    // Dispatch Cmd+K to open the command palette
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      }),
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="hidden md:inline-flex gap-2 text-muted-foreground font-normal"
    >
      <MagnifyingGlass className="size-4" />
      <span className="text-xs">Search...</span>
      <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-[11px]">&#8984;</span>K
      </kbd>
    </Button>
  )
}

export function SiteHeader(): React.ReactElement {
  const pathname = usePathname()
  const { selectedChainId, setSelectedChainId } = useChainFilter()

  const title =
    routeTitles[pathname] ??
    (pathname.startsWith("/agents/") ? "Agent Detail" :
     pathname.startsWith("/cre/") ? "Workflow Detail" :
     pathname.startsWith("/verify/report/") ? "Credit Report" : "Qova")

  useEffect(() => {
    document.title = title === "Qova" ? "Qova" : `${title} | Qova`
  }, [title])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <SearchTrigger />
          <ChainSelector
            compact
            showAll
            value={selectedChainId || undefined}
            onValueChange={setSelectedChainId}
          />
          <Button variant="ghost" size="sm" asChild className="size-8 p-0">
            <Link href="/alerts">
              <Bell className="size-4" />
              <span className="sr-only">Notifications</span>
            </Link>
          </Button>
          <ThemeToggle />
          <HeaderWallet />
        </div>
      </div>
    </header>
  )
}
