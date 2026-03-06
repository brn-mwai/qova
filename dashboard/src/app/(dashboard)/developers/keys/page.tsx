"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../../../convex/_generated/api"
import type { Id } from "../../../../../convex/_generated/dataModel"
import {
  Key,
  Plus,
  Copy,
  Trash,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/shared/page-header"
import { toast } from "sonner"

const AVAILABLE_SCOPES = [
  { value: "agents:read", label: "Agents Read", description: "Read agent details, scores, and registration status" },
  { value: "agents:write", label: "Agents Write", description: "Register agents, update scores, set budgets" },
  { value: "transactions:read", label: "Transactions Read", description: "Read transaction history and stats" },
  { value: "transactions:write", label: "Transactions Write", description: "Record transactions and spend" },
  { value: "scores:read", label: "Scores Read", description: "Access score computation and enrichment" },
  { value: "admin", label: "Admin", description: "Full access — create and manage API keys" },
] as const

const EXPIRY_OPTIONS = [
  { value: undefined, label: "Never expires" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
]

export default function ApiKeysPage(): React.ReactElement {
  const keys = useQuery(api.queries.apiKeys.listByUser)
  const createKey = useMutation(api.mutations.apiKeys.create)
  const revokeKey = useMutation(api.mutations.apiKeys.revoke)
  const deleteKey = useMutation(api.mutations.apiKeys.remove)

  const [createOpen, setCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["agents:read", "scores:read"])
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  function toggleScope(scope: string) {
    if (scope === "admin") {
      // Admin toggles all scopes off/on
      if (selectedScopes.includes("admin")) {
        setSelectedScopes([])
      } else {
        setSelectedScopes(["admin"])
      }
      return
    }
    // If admin is selected, unselect it first
    const withoutAdmin = selectedScopes.filter((s) => s !== "admin")
    if (withoutAdmin.includes(scope)) {
      setSelectedScopes(withoutAdmin.filter((s) => s !== scope))
    } else {
      setSelectedScopes([...withoutAdmin, scope])
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim() || selectedScopes.length === 0) return
    setCreating(true)
    try {
      const result = await createKey({
        name: newKeyName.trim(),
        scopes: selectedScopes,
        expiresInDays,
      })
      setRevealedKey(result.key)
      setCreateOpen(false)
      setNewKeyName("")
      setSelectedScopes(["agents:read", "scores:read"])
      setExpiresInDays(undefined)
      toast.success("API key created. Copy it now — it won't be shown again.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create key")
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    try {
      await revokeKey({ id: id as Id<"apiKeys"> })
      toast.success("API key revoked")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke key")
    } finally {
      setRevoking(null)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteKey({ id: id as Id<"apiKeys"> })
      toast.success("API key deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete key")
    }
  }

  const activeKeys = keys?.filter((k) => k.isActive) ?? []
  const revokedKeys = keys?.filter((k) => !k.isActive) ?? []

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <PageHeader
          breadcrumb="Developers"
          title="API Keys"
          subtitle="Programmatic access to the Qova protocol"
          actions={
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-1" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Select scopes to control what this key can access.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label>Key Name</Label>
                    <Input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production, CI/CD Pipeline"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Scopes</Label>
                    <div className="space-y-2">
                      {AVAILABLE_SCOPES.map((scope) => (
                        <label
                          key={scope.value}
                          className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedScopes.includes(scope.value) || selectedScopes.includes("admin")}
                            onCheckedChange={() => toggleScope(scope.value)}
                            disabled={scope.value !== "admin" && selectedScopes.includes("admin")}
                          />
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium leading-none">{scope.label}</div>
                            <div className="text-xs text-muted-foreground">{scope.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Expiration</Label>
                    <div className="flex flex-wrap gap-2">
                      {EXPIRY_OPTIONS.map((option) => (
                        <Button
                          key={option.label}
                          type="button"
                          variant={expiresInDays === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setExpiresInDays(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyName.trim() || selectedScopes.length === 0 || creating}
                  >
                    {creating ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="px-4 lg:px-6">
          <div className="rounded-lg border border-score-green-border bg-score-green-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Warning className="size-4 text-amber-500 shrink-0" weight="fill" />
                  <p className="text-sm font-medium">Your new API key</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Copy this key now. It will not be shown again.
                </p>
                <code className="block font-mono text-sm bg-background px-3 py-2 rounded border break-all select-all">
                  {revealedKey}
                </code>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedKey)
                    toast.success("Copied to clipboard")
                  }}
                >
                  <Copy className="size-3.5 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevealedKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick start hint */}
      {activeKeys.length === 0 && !keys && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
              <div className="animate-pulse h-4 w-4 rounded-full bg-muted-foreground/30" />
              <span className="text-sm">Loading keys...</span>
            </CardContent>
          </Card>
        </div>
      )}

      {keys && activeKeys.length === 0 && !revealedKey && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldCheck className="size-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">No API keys yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first key to start using the Qova API.
                </p>
              </div>
              <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4 mr-1" />
                Create your first key
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active keys table */}
      {activeKeys.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Keys</CardTitle>
              <CardDescription>
                {activeKeys.length} active key{activeKeys.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-xs">Name</TableHead>
                    <TableHead className="text-xs">Key</TableHead>
                    <TableHead className="text-xs">Scopes</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="text-xs">Last Used</TableHead>
                    <TableHead className="text-xs">Expires</TableHead>
                    <TableHead className="pr-6 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeKeys.map((key) => (
                    <TableRow key={key._id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <Key className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{key.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {key.keyPrefix}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.includes("admin") ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                              admin
                            </Badge>
                          ) : (
                            <>
                              {key.scopes.slice(0, 2).map((scope: string) => (
                                <Badge key={scope} variant="outline" className="text-[10px]">
                                  {scope}
                                </Badge>
                              ))}
                              {key.scopes.length > 2 && (
                                <Badge variant="outline" className="text-[10px]">
                                  +{key.scopes.length - 2}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-muted-foreground hover:text-destructive"
                          disabled={revoking === key._id}
                          onClick={() => handleRevoke(key._id)}
                          title="Revoke key"
                        >
                          <Trash className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Revoked Keys</CardTitle>
              <CardDescription>
                {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-xs">Name</TableHead>
                    <TableHead className="text-xs">Key</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="pr-6 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revokedKeys.map((key) => (
                    <TableRow key={key._id} className="opacity-60">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <Key className="size-4 text-muted-foreground" />
                          <span className="text-sm">{key.name}</span>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Revoked
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {key.keyPrefix}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(key._id)}
                          title="Delete permanently"
                        >
                          <Trash className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage snippet */}
      {activeKeys.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Start</CardTitle>
              <CardDescription>Use your API key with the SDK or REST API</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto font-mono">
{`import Qova from "@qova/core";

const qova = new Qova("qova_your_api_key");

// Check an agent's reputation
const { score, grade } = await qova.agents.score("0xAGENT");
console.log(\`Score: \${score}/1000 (\${grade})\`);

// Verify trust before transacting
const { verified } = await qova.verify("0xAGENT");`}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
