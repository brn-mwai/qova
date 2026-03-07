"use client"

import { useState, useCallback, useMemo } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import {
  Robot,
  SpinnerGap,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { toast } from "sonner"
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID, getChain } from "@/lib/chains"
import { getTokensForChain } from "@/lib/tokens"

const DEFAULT_CURRENCY = "USDC.e"

const AGENT_TYPES = [
  { value: "trading", label: "Trading Bot" },
  { value: "oracle", label: "Oracle" },
  { value: "bridge", label: "Bridge" },
  { value: "payment", label: "Payment" },
  { value: "dao", label: "DAO Governor" },
  { value: "custom", label: "Custom" },
] as const

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

interface RegisterAgentDialogProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RegisterAgentDialog({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RegisterAgentDialogProps): React.ReactElement {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen

  const available = useConvexAvailable()
  const upsertAgent = useMutation(api.mutations.agents.upsertAgent)
  const logActivity = useMutation(api.mutations.activity.logActivity)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    address: "",
    name: "",
    type: "trading",
    description: "",
    chainId: DEFAULT_CHAIN_ID,
    budgetCurrency: DEFAULT_CURRENCY,
    dailyLimit: "1",
    monthlyLimit: "10",
    perTxLimit: "0.5",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const chainTokens = useMemo(
    () => getTokensForChain(form.chainId),
    [form.chainId],
  )

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!isValidAddress(form.address)) {
      errs.address = "Invalid wallet address (0x + 40 hex characters)"
    }
    if (form.name.length < 3) {
      errs.name = "Name must be at least 3 characters"
    }
    if (form.name.length > 50) {
      errs.name = "Name must be at most 50 characters"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form.address, form.name])

  const resetForm = useCallback((): void => {
    setForm({
      address: "",
      name: "",
      type: "trading",
      description: "",
      chainId: DEFAULT_CHAIN_ID,
      budgetCurrency: DEFAULT_CURRENCY,
      dailyLimit: "1",
      monthlyLimit: "10",
      perTxLimit: "0.5",
    })
    setErrors({})
  }, [])

  const handleChainChange = useCallback((chainIdStr: string): void => {
    const chainId = Number(chainIdStr)
    const tokens = getTokensForChain(chainId)
    const defaultCurrency = tokens[0]?.symbol ?? getChain(chainId)?.nativeCurrency.symbol ?? DEFAULT_CURRENCY
    setForm((prev) => ({
      ...prev,
      chainId,
      budgetCurrency: defaultCurrency,
    }))
  }, [])

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!validate()) return

    if (!available) {
      toast.error("Database not configured. Set NEXT_PUBLIC_CONVEX_URL to enable registration.")
      return
    }

    setLoading(true)

    try {
      const addressShort = `${form.address.slice(0, 6)}...${form.address.slice(-4)}`

      await upsertAgent({
        address: form.address,
        name: form.name,
        description: form.description || undefined,
        score: 0,
        isRegistered: true,
        chainId: form.chainId,
        budgetCurrency: form.budgetCurrency,
        dailyLimit: form.dailyLimit,
        monthlyLimit: form.monthlyLimit,
        perTxLimit: form.perTxLimit,
      })

      await logActivity({
        agent: form.address,
        type: "registration",
        description: `Agent "${form.name}" (${form.type}) registered on ${SUPPORTED_CHAINS.find((c) => c.id === form.chainId)?.name ?? "Base"}`,
        chainId: form.chainId,
        currency: form.budgetCurrency,
      })

      toast.success(`Agent "${form.name || addressShort}" registered successfully`)
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }, [validate, available, form, upsertAgent, logActivity, resetForm, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Robot size={20} />
            Register Agent
          </DialogTitle>
          <DialogDescription>
            Register a new AI agent. This creates a record and begins reputation tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Address */}
          <div className="grid gap-2">
            <Label htmlFor="reg-address">Agent Address</Label>
            <Input
              id="reg-address"
              placeholder="0x..."
              className="font-mono"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>

          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="reg-name">Agent Name</Label>
            <Input
              id="reg-name"
              placeholder="e.g., AlphaTrader v2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Type + Chain row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Agent Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Chain</Label>
              <Select
                value={String(form.chainId)}
                onValueChange={handleChainChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="reg-description">
              Description
              <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="reg-description"
              placeholder="What does this agent do?"
              maxLength={500}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {form.description.length > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                {form.description.length}/500
              </p>
            )}
          </div>

          {/* Budget section */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Budget Limits</Label>
              <Select
                value={form.budgetCurrency}
                onValueChange={(v) => setForm({ ...form, budgetCurrency: v })}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chainTokens.map((t) => (
                    <SelectItem key={t.symbol} value={t.symbol}>
                      {t.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label
                  htmlFor="reg-daily"
                  className="text-xs text-muted-foreground font-normal"
                >
                  Daily ({form.budgetCurrency})
                </Label>
                <Input
                  id="reg-daily"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.dailyLimit}
                  onChange={(e) =>
                    setForm({ ...form, dailyLimit: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
              <div className="grid gap-1">
                <Label
                  htmlFor="reg-monthly"
                  className="text-xs text-muted-foreground font-normal"
                >
                  Monthly ({form.budgetCurrency})
                </Label>
                <Input
                  id="reg-monthly"
                  type="number"
                  step="1"
                  min="0"
                  value={form.monthlyLimit}
                  onChange={(e) =>
                    setForm({ ...form, monthlyLimit: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
              <div className="grid gap-1">
                <Label
                  htmlFor="reg-pertx"
                  className="text-xs text-muted-foreground font-normal"
                >
                  Per-Tx ({form.budgetCurrency})
                </Label>
                <Input
                  id="reg-pertx"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.perTxLimit}
                  onChange={(e) =>
                    setForm({ ...form, perTxLimit: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <SpinnerGap size={14} className="animate-spin" />}
            {loading ? "Registering..." : "Register Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
