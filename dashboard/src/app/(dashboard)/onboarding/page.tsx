"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { motion, AnimatePresence } from "framer-motion"
import { useAccount, useDisconnect } from "wagmi"
import {
  ConnectWallet,
  Wallet as OnchainWallet,
} from "@coinbase/onchainkit/wallet"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChartLineUp,
  ShieldCheck,
  Wallet,
  Code,
  Users,
  Binoculars,
  Robot,
  SpinnerGap,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react"
import { api } from "../../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { cn } from "@/lib/utils"

const TOTAL_STEPS = 5

const roles = [
  {
    id: "developer",
    label: "Developer",
    description: "I'm building agents that interact on-chain",
    icon: Code,
  },
  {
    id: "team_lead",
    label: "Team Lead",
    description: "I'm managing a team of agent developers",
    icon: Users,
  },
  {
    id: "explorer",
    label: "Explorer",
    description: "I'm evaluating Qova for my organization",
    icon: Binoculars,
  },
] as const

const features = [
  {
    icon: ChartLineUp,
    title: "Real-time Scores",
    description:
      "Every agent gets a 0-1000 reputation score, updated by Chainlink CRE workflows.",
  },
  {
    icon: Wallet,
    title: "Budget Controls",
    description:
      "Set daily, monthly, and per-transaction limits to manage risk.",
  },
  {
    icon: ShieldCheck,
    title: "Instant Verification",
    description:
      "Anyone can verify an agent's reputation via the public /verify page.",
  },
] as const

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function OnboardingPage(): React.ReactElement {
  const router = useRouter()
  const available = useConvexAvailable()
  const user = useQuery(api.users.currentUser, available ? {} : "skip")
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const updatePreferences = useMutation(api.users.updatePreferences)
  const upsertAgent = useMutation(api.mutations.agents.upsertAgent)
  const linkWallet = useMutation(api.mutations.users.linkWallet)
  const seedDemo = useMutation(api.mutations.seed.seedDemoData)

  const { address: walletAddress, isConnected: walletConnected } = useAccount()
  const { disconnect: disconnectWallet } = useDisconnect()

  const [step, setStep] = useState(0)
  const [selectedRole, setSelectedRole] = useState("developer")
  const [agentAddress, setAgentAddress] = useState("")
  const [agentName, setAgentName] = useState("")
  const [agentError, setAgentError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [walletLinking, setWalletLinking] = useState(false)
  const [walletLinked, setWalletLinked] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  // Redirect if already onboarded
  useEffect(() => {
    if (user?.onboardingComplete) {
      router.replace("/")
    }
  }, [user, router])

  const userName = user?.name ?? "there"

  const handleNext = useCallback((): void => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1)
  }, [step])

  const handleBack = useCallback((): void => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  const handleRegisterAgent = useCallback(async (): Promise<void> => {
    if (!isValidAddress(agentAddress)) {
      setAgentError("Enter a valid Ethereum address (0x + 40 hex characters)")
      return
    }
    if (agentName.length < 3) {
      setAgentError("Name must be at least 3 characters")
      return
    }
    setAgentError(null)
    setSubmitting(true)
    try {
      await upsertAgent({
        address: agentAddress,
        name: agentName,
        score: 0,
        isRegistered: true,
      })
      handleNext()
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setSubmitting(false)
    }
  }, [agentAddress, agentName, upsertAgent, handleNext])

  // Link wallet to Convex user
  const handleLinkWallet = useCallback(async (): Promise<void> => {
    if (!walletAddress || !available) return
    setWalletLinking(true)
    setWalletError(null)
    try {
      await linkWallet({ walletAddress })
      setWalletLinked(true)
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to link wallet")
    } finally {
      setWalletLinking(false)
    }
  }, [walletAddress, available, linkWallet])

  // Auto-link when wallet connects
  useEffect(() => {
    if (walletConnected && walletAddress && available && !walletLinked && !walletLinking && step === 3) {
      handleLinkWallet()
    }
  }, [walletConnected, walletAddress, available, walletLinked, walletLinking, step, handleLinkWallet])

  const handleComplete = useCallback(async (): Promise<void> => {
    setCompleting(true)
    try {
      if (available) {
        await updatePreferences({ role: selectedRole })
        await seedDemo({}).catch(() => {})
        await completeOnboarding({})
      }
      router.push("/")
    } catch {
      router.push("/")
    }
  }, [available, updatePreferences, selectedRole, seedDemo, completeOnboarding, router])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Enter" && step === 0) handleNext()
      if (e.key === "Escape") handleBack()
    }
    document.addEventListener("keydown", handleKeyDown)
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [step, handleNext, handleBack])

  if (user?.onboardingComplete) return <div />

  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step
                  ? "w-8 bg-foreground"
                  : i < step
                    ? "w-4 bg-foreground/40"
                    : "w-4 bg-border",
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ---- Step 0: Welcome + Role ---- */}
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h1 className="font-heading text-2xl font-semibold">
                  Welcome to Qova, {userName}!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Let&apos;s get your account set up.
                </p>
              </div>

              <div className="space-y-3">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors cursor-pointer",
                      selectedRole === role.id
                        ? "border-foreground bg-accent"
                        : "border-border hover:bg-accent/50",
                    )}
                  >
                    <role.icon
                      size={20}
                      weight={selectedRole === role.id ? "fill" : "regular"}
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium">{role.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight size={14} />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ---- Step 1: First Agent ---- */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h1 className="font-heading text-2xl font-semibold">
                  Register your first agent
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can skip this and do it later.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="ob-address">Agent Address</Label>
                  <Input
                    id="ob-address"
                    placeholder="0x..."
                    className="font-mono"
                    value={agentAddress}
                    onChange={(e) => setAgentAddress(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-name">Agent Name</Label>
                  <Input
                    id="ob-name"
                    placeholder="e.g., AlphaTrader v2"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                </div>
                {agentError && (
                  <p className="text-xs text-destructive">{agentError}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft size={14} />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={handleNext}>
                    Skip for now
                  </Button>
                  <Button
                    onClick={handleRegisterAgent}
                    disabled={submitting}
                  >
                    {submitting && (
                      <SpinnerGap size={14} className="animate-spin" />
                    )}
                    {submitting ? "Registering..." : "Register & Continue"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- Step 2: Feature Tour ---- */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h1 className="font-heading text-2xl font-semibold">
                  What Qova does
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Financial trust infrastructure for AI agents.
                </p>
              </div>

              <div className="space-y-3">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-start gap-4 rounded-lg border border-border p-4"
                  >
                    <feature.icon
                      size={20}
                      weight="duotone"
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <div>
                      <p className="text-sm font-medium">{feature.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft size={14} />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight size={14} />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ---- Step 3: Connect Wallet ---- */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h1 className="font-heading text-2xl font-semibold">
                  Connect a wallet
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Link a wallet for on-chain verification. This is optional.
                </p>
              </div>

              <div className="rounded-lg border border-border p-6 space-y-5">
                {!walletConnected ? (
                  <>
                    <div className="flex justify-center">
                      <OnchainWallet>
                        <ConnectWallet className="!flex !items-center !justify-center !gap-2 !w-full !rounded-md !border !border-border !bg-foreground !px-4 !py-2.5 !text-sm !font-medium !text-background !shadow-none hover:!bg-foreground/90">
                          <Wallet className="size-4" />
                          <span>Connect Wallet</span>
                        </ConnectWallet>
                      </OnchainWallet>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Supported wallets
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Coinbase Smart Wallet
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Coinbase Wallet
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-full bg-[var(--score-green)]" />
                      <span className="font-mono text-sm">
                        {walletAddress ? truncateAddress(walletAddress) : ""}
                      </span>
                      {walletLinked && (
                        <CheckCircle
                          size={16}
                          weight="fill"
                          className="text-[var(--score-green)]"
                        />
                      )}
                    </div>

                    {walletLinking && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <SpinnerGap size={14} className="animate-spin" />
                        Linking to your account...
                      </div>
                    )}
                    {walletLinked && (
                      <p className="text-xs text-[var(--score-green)]">
                        Wallet linked successfully
                      </p>
                    )}
                    {walletError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <Warning size={14} />
                        {walletError}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft size={14} />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  {!walletConnected && (
                    <Button variant="ghost" onClick={handleNext}>
                      Skip for now
                    </Button>
                  )}
                  {walletConnected && (
                    <Button onClick={handleNext}>
                      Continue
                      <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- Step 4: Ready ---- */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.1,
                  }}
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground"
                >
                  <Check size={32} weight="bold" />
                </motion.div>
                <h1 className="font-heading text-2xl font-semibold">
                  You&apos;re all set!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your dashboard is ready. Start monitoring agent reputation and managing risk.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft size={14} />
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={completing}>
                  {completing && (
                    <SpinnerGap size={14} className="animate-spin" />
                  )}
                  {completing ? "Loading..." : "Go to Dashboard"}
                  {!completing && <ArrowRight size={14} />}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
