"use client"

import { useState } from "react"
import {
  Cloud,
  Gear,
  Link as LinkIcon,
  ShieldCheck,
  Copy,
  Check,
} from "@phosphor-icons/react"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { StatusBadge } from "@/components/data/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/page-header"

function EnvironmentToggle(): React.ReactElement {
  const [env, setEnv] = useState<"sandbox" | "production">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("qova_env") as "sandbox" | "production") ?? "sandbox"
    }
    return "sandbox"
  })

  function toggle(): void {
    const next = env === "sandbox" ? "production" : "sandbox"
    setEnv(next)
    if (typeof window !== "undefined") {
      localStorage.setItem("qova_env", next)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={
          env === "production"
            ? "bg-rose-500/10 text-rose-600 border-rose-200"
            : "bg-teal-500/10 text-teal-600 border-teal-200"
        }
      >
        {env === "production" ? "Production" : "Sandbox"}
      </Badge>
      <Button variant="outline" size="sm" onClick={toggle}>
        Switch to {env === "sandbox" ? "Production" : "Sandbox"}
      </Button>
    </div>
  )
}
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function CopyButton({ value }: { value: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)

  function handleCopy(): void {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" className="size-7 p-0" onClick={handleCopy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

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

export default function SettingsPage(): React.ReactElement {
  const convexAvailable = useConvexAvailable()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "Not configured"
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "Not configured"

  return (
    <div className="px-4 lg:px-6">
      <div className="mx-auto max-w-3xl w-full space-y-6">
        <PageHeader
          breadcrumb="Settings"
          title="Settings"
          subtitle="Dashboard preferences and account management"
        />

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gear size={16} />
              Profile
            </CardTitle>
            <CardDescription>
              Your personal account information managed through Clerk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="Qova User"
                  disabled
                  className="bg-muted"
                />
                <p className="text-[10px] text-muted-foreground">
                  Managed by Clerk. Update in your profile.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="user@qova.cc"
                  disabled
                  className="bg-muted"
                />
                <p className="text-[10px] text-muted-foreground">
                  Primary email linked to your account.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org">Organization</Label>
              <Input
                id="org"
                placeholder="My Organization"
                disabled
                className="bg-muted"
              />
              <p className="text-[10px] text-muted-foreground">
                Organization membership is managed in Team settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cloud size={16} />
              System Status
            </CardTitle>
            <CardDescription>
              Runtime services and infrastructure health.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Convex Database"
              description="Real-time database for agent data, scores, and activity"
            >
              <StatusBadge status={convexAvailable ? "active" : "inactive"} />
            </SettingRow>
            <SettingRow
              label="Qova API"
              description="On-chain API for agent registration, scoring, and verification"
            >
              <code className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {apiUrl === "Not configured" ? "Not set" : "Configured"}
              </code>
            </SettingRow>
            <SettingRow
              label="Convex URL"
              description="Deployment endpoint for real-time data sync"
            >
              <code className="rounded border bg-muted px-2 py-0.5 font-mono text-xs max-w-48 truncate">
                {convexUrl === "Not configured" ? "Not set" : convexUrl.replace("https://", "")}
              </code>
              {convexUrl !== "Not configured" && <CopyButton value={convexUrl} />}
            </SettingRow>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <LinkIcon size={16} />
              Network
            </CardTitle>
            <CardDescription>
              Blockchain network and chain configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow label="Chain" description="Target blockchain network">
              <span className="font-mono text-xs">Base Sepolia</span>
            </SettingRow>
            <SettingRow label="Chain ID" description="Numeric chain identifier">
              <span className="font-mono text-xs">84532</span>
            </SettingRow>
            <SettingRow label="Explorer" description="Block explorer for transaction verification">
              <a
                href="https://sepolia.basescan.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                sepolia.basescan.org
              </a>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cloud size={16} />
              Environment
            </CardTitle>
            <CardDescription>
              Switch between sandbox and production API environments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Active Environment"
              description="Sandbox uses testnet (Base Sepolia) with mock data. Production uses mainnet."
            >
              <EnvironmentToggle />
            </SettingRow>
            <SettingRow
              label="API Base URL"
              description="Automatically set based on the active environment"
            >
              <code className="text-[11px] px-2 py-0.5 bg-muted rounded font-mono">
                {typeof window !== "undefined" && localStorage.getItem("qova_env") === "production"
                  ? "https://api.qova.cc"
                  : "https://sandbox.api.qova.cc"}
              </code>
            </SettingRow>
            <SettingRow
              label="Chain"
              description="Blockchain network for on-chain operations"
            >
              <span className="text-xs text-muted-foreground">
                {typeof window !== "undefined" && localStorage.getItem("qova_env") === "production"
                  ? "Base Mainnet (8453)"
                  : "Base Sepolia (84532)"}
              </span>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck size={16} />
              Security
            </CardTitle>
            <CardDescription>
              Authentication and verification methods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Authentication"
              description="Identity provider for user sessions"
            >
              <span className="text-xs text-muted-foreground">Clerk SIWE</span>
            </SettingRow>
            <SettingRow
              label="Score Verification"
              description="Decentralized oracle network for trust scores"
            >
              <span className="text-xs text-muted-foreground">Chainlink CRE</span>
            </SettingRow>
            <SettingRow
              label="Data Integrity"
              description="On-chain hash anchoring for score immutability"
            >
              <span className="text-xs text-muted-foreground">Base L2</span>
            </SettingRow>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
