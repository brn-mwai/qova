"use client"

import {
  Cloud,
  Fingerprint,
  Gear,
  Link as LinkIcon,
  ShieldCheck,
} from "@phosphor-icons/react"
import { useUser, useClerk } from "@clerk/nextjs"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { StatusBadge } from "@/components/data/status-badge"
import { WorldIdVerifyButton } from "@/components/world-id/verify-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/shared/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const CHAIN_CONFIG = {
  name: process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Base",
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? "8453",
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://basescan.org",
  explorerLabel: process.env.NEXT_PUBLIC_EXPLORER_LABEL ?? "basescan.org",
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
  const { user } = useUser()
  const { openUserProfile } = useClerk()
  const convexAvailable = useConvexAvailable()

  return (
    <div className="px-4 lg:px-6">
      <div className="mx-auto max-w-3xl w-full space-y-6">
        <PageHeader
          breadcrumb="Settings"
          title="Settings"
          subtitle="Dashboard preferences and account management"
          info={{
            description: "Manage your account, verify your identity, and review system health and network configuration.",
            sections: [
              { title: "Profile", description: "Your display name, email, and user ID." },
              { title: "Identity Verification", description: "Verify your identity with World ID to boost your agents' trust scores." },
              { title: "System Status", description: "Health checks for database, authentication, and blockchain connections." },
            ],
          }}
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
                  value={user?.fullName ?? user?.firstName ?? ""}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-[10px] text-muted-foreground">
                  Managed by Clerk.{" "}
                  <button
                    type="button"
                    onClick={() => openUserProfile()}
                    className="underline hover:text-foreground"
                  >
                    Update profile
                  </button>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.primaryEmailAddress?.emailAddress ?? ""}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-[10px] text-muted-foreground">
                  Primary email linked to your account.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={user?.id ?? ""}
                readOnly
                className="bg-muted font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Your unique Clerk identifier.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* World ID Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Fingerprint size={16} />
              Identity Verification
            </CardTitle>
            <CardDescription>
              Verify your identity with World ID to boost agent trust scores and unlock
              premium features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorldIdVerifyButton />
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
              Service health for dashboard infrastructure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Database & Actions"
              description="Real-time data, agent registration, scoring, and verification"
            >
              <StatusBadge status={convexAvailable ? "active" : "inactive"} />
            </SettingRow>
            <SettingRow
              label="Authentication"
              description="User identity and session management"
            >
              <StatusBadge status="active" />
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
              Blockchain network configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow label="Chain" description="Target blockchain network">
              <span className="font-mono text-xs">{CHAIN_CONFIG.name}</span>
            </SettingRow>
            <SettingRow label="Chain ID" description="Numeric chain identifier">
              <span className="font-mono text-xs">{CHAIN_CONFIG.chainId}</span>
            </SettingRow>
            <SettingRow label="Explorer" description="Block explorer for transaction verification">
              <a
                href={CHAIN_CONFIG.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {CHAIN_CONFIG.explorerLabel}
              </a>
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
              Verification and trust infrastructure.
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
              <span className="text-xs text-muted-foreground">{CHAIN_CONFIG.name}</span>
            </SettingRow>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
