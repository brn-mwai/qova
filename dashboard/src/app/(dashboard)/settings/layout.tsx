"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gear, Users, Bell, Wallet } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

const settingsNav = [
  { href: "/settings", label: "General", icon: Gear },
  { href: "/settings/wallet", label: "Wallet", icon: Wallet },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account, team, and preferences.
        </p>
      </div>

      <div className="px-4 lg:px-6">
        <nav className="flex gap-1 border-b">
          {settingsNav.map((item) => {
            const isActive =
              item.href === "/settings"
                ? pathname === "/settings"
                : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {children}
    </div>
  )
}
