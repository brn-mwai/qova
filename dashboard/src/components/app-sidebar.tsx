"use client"

import {
  ArrowsLeftRight,
  ChartBar,
  ChartLine,
  ChartLineUp,
  Code,
  Gear,
  Globe,
  Key,
  Plugs,
  Robot,
  ShieldCheck,
  Wallet,
  WebhooksLogo,
  Question,
} from "@phosphor-icons/react"
import { LogoMark } from "@/components/brand/logo-mark"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { SidebarWallet } from "@/components/sidebar-wallet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const data = {
  navOperations: [
    {
      title: "Overview",
      url: "/",
      icon: ChartBar,
    },
    {
      title: "Agents",
      url: "/agents",
      icon: Robot,
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: ArrowsLeftRight,
    },
    {
      title: "Budgets",
      url: "/budgets",
      icon: Wallet,
    },
    {
      title: "Integrations",
      url: "/integrations",
      icon: Plugs,
    },
  ],
  navIntelligence: [
    {
      title: "CRE Engine",
      url: "/cre",
      icon: ChartLineUp,
    },
    {
      title: "Ecosystem",
      url: "/ecosystem",
      icon: Globe,
    },
    {
      title: "Scores",
      url: "/scores",
      icon: ChartLine,
    },
    {
      title: "Verify",
      url: "/verify",
      icon: ShieldCheck,
    },
  ],
  navDevelopers: [
    {
      title: "API Keys",
      url: "/developers/keys",
      icon: Key,
    },
    {
      title: "Webhooks",
      url: "/developers/webhooks",
      icon: WebhooksLogo,
    },
    {
      title: "Usage",
      url: "/developers/usage",
      icon: ChartBar,
    },
    {
      title: "API Docs",
      url: "/developers/docs",
      icon: Code,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: Gear,
    },
    {
      title: "Help",
      url: "https://docs.qova.cc",
      icon: Question,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>): React.ReactElement {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <LogoMark className="!h-5 !w-auto" />
                <div className="flex flex-col gap-0 leading-none">
                  <span className="text-sm font-semibold tracking-tight">Qova</span>
                  <span className="text-[10px] text-muted-foreground">Trust Infrastructure</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Operations" items={data.navOperations} />
        <NavMain label="Intelligence" items={data.navIntelligence} />
        <NavMain label="Developers" items={data.navDevelopers} />
        <SidebarSeparator className="mx-0" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <SidebarWallet />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
