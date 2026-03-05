"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  CurrencyCircleDollar,
  Timer,
  ShieldCheck,
  ChartLineUp,
  ArrowLeft,
  CheckCircle,
  XCircle,
  CircleNotch,
  Pause,
  Play,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCreWorkflow,
  useCreExecutions,
} from "@/hooks/use-convex-data"
import { useMutation } from "convex/react"
import { api } from "../../../../../convex/_generated/api"
import { toast } from "sonner"
import { useCallback, useState } from "react"
import type { ComponentType } from "react"
import type { IconProps } from "@phosphor-icons/react"

const iconMap: Record<string, ComponentType<IconProps>> = {
  CurrencyCircleDollar,
  Timer,
  ShieldCheck,
  ChartLineUp,
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusIcon({ status }: { status: string }): React.ReactElement {
  if (status === "completed") {
    return <CheckCircle weight="fill" className="size-4 text-score-green" />
  }
  if (status === "failed") {
    return <XCircle weight="fill" className="size-4 text-destructive" />
  }
  return <CircleNotch className="size-4 text-muted-foreground animate-spin" />
}

function WorkflowDetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <Skeleton className="h-5 w-24 mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="px-4 lg:px-6 grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}

export default function WorkflowDetailPage(): React.ReactElement {
  const params = useParams()
  const workflowId = params.workflow as string
  const workflow = useCreWorkflow(workflowId)
  const executions = useCreExecutions(workflowId, 50)
  const updateStatus = useMutation(api.mutations.cre.updateWorkflowStatus)
  const [toggling, setToggling] = useState(false)

  const handleToggleStatus = useCallback(async () => {
    if (!workflow) return
    const newStatus = workflow.status === "active" ? "paused" : "active"
    setToggling(true)
    try {
      await updateStatus({ workflowId, status: newStatus })
      toast.success(`Workflow ${newStatus === "active" ? "resumed" : "paused"}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setToggling(false)
    }
  }, [workflow, workflowId, updateStatus])

  if (!workflow) {
    return <WorkflowDetailSkeleton />
  }

  const Icon = iconMap[workflow.icon] ?? ChartLineUp
  const completedExecs = executions.filter((e) => e.status === "completed")
  const failedExecs = executions.filter((e) => e.status === "failed")
  const avgDuration =
    completedExecs.length > 0
      ? Math.round(
          completedExecs.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) /
            completedExecs.length,
        )
      : 0

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Back link + Header */}
      <div className="px-4 lg:px-6">
        <Link
          href="/cre"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" />
          Back to CRE Engine
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{workflow.name}</h2>
              <p className="text-sm text-muted-foreground">{workflow.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {workflow.status === "active" ? (
              <Badge
                variant="outline"
                className="text-score-green border-score-green-border bg-score-green-bg"
              >
                Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-score-yellow border-score-yellow-border bg-score-yellow-bg"
              >
                {workflow.status}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={toggling}
            >
              {workflow.status === "active" ? (
                <><Pause size={14} weight="fill" /> Pause</>
              ) : (
                <><Play size={14} weight="fill" /> Resume</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4 lg:px-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Runs</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {workflow.totalRuns.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Success Rate</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {workflow.successRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Duration</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {avgDuration > 0 ? formatDuration(avgDuration) : "--"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Weight</p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {(workflow.weight * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-4 lg:px-6">
        <Tabs defaultValue="executions">
          <TabsList variant="line">
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          {/* Executions Tab */}
          <TabsContent value="executions" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Execution History</CardTitle>
                    <CardDescription>
                      {executions.length} executions loaded
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {executions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 text-xs w-8">Status</TableHead>
                        <TableHead className="text-xs">Agent</TableHead>
                        <TableHead className="text-xs text-right">Input</TableHead>
                        <TableHead className="text-xs text-right">Output</TableHead>
                        <TableHead className="text-xs text-right">Duration</TableHead>
                        <TableHead className="pr-6 text-xs text-right">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((exec) => (
                        <TableRow key={exec._id}>
                          <TableCell className="pl-6">
                            <StatusIcon status={exec.status} />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {exec.agentAddress
                              ? `${exec.agentAddress.slice(0, 6)}...${exec.agentAddress.slice(-4)}`
                              : "batch"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {exec.inputScore ?? "--"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {exec.outputScore ?? "--"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {exec.durationMs ? formatDuration(exec.durationMs) : "--"}
                          </TableCell>
                          <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                            {formatDate(exec.startedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No executions yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Success vs Failure</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Completed</span>
                        <span className="font-mono text-xs tabular-nums text-score-green">
                          {completedExecs.length}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${executions.length > 0 ? (completedExecs.length / executions.length) * 100 : 0}%`,
                            backgroundColor: "var(--score-green)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Failed</span>
                        <span className="font-mono text-xs tabular-nums text-destructive">
                          {failedExecs.length}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive"
                          style={{
                            width: `${executions.length > 0 ? (failedExecs.length / executions.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Duration Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Min</span>
                      <span className="font-mono tabular-nums">
                        {completedExecs.length > 0
                          ? formatDuration(
                              Math.min(...completedExecs.map((e) => e.durationMs ?? 0)),
                            )
                          : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Average</span>
                      <span className="font-mono tabular-nums">
                        {avgDuration > 0 ? formatDuration(avgDuration) : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Max</span>
                      <span className="font-mono tabular-nums">
                        {completedExecs.length > 0
                          ? formatDuration(
                              Math.max(...completedExecs.map((e) => e.durationMs ?? 0)),
                            )
                          : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">P95</span>
                      <span className="font-mono tabular-nums">
                        {completedExecs.length > 0
                          ? formatDuration(
                              completedExecs
                                .map((e) => e.durationMs ?? 0)
                                .sort((a, b) => a - b)[
                                Math.floor(completedExecs.length * 0.95)
                              ] ?? 0,
                            )
                          : "--"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Score Impact</CardTitle>
                  <CardDescription>
                    How this workflow affects agent scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Input</p>
                      <p className="font-mono text-lg font-bold tabular-nums">
                        {completedExecs.length > 0
                          ? Math.round(
                              completedExecs.reduce(
                                (sum, e) => sum + (e.inputScore ?? 0),
                                0,
                              ) / completedExecs.length,
                            )
                          : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Output</p>
                      <p className="font-mono text-lg font-bold tabular-nums">
                        {completedExecs.length > 0
                          ? Math.round(
                              completedExecs.reduce(
                                (sum, e) => sum + (e.outputScore ?? 0),
                                0,
                              ) / completedExecs.length,
                            )
                          : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Delta</p>
                      <p className="font-mono text-lg font-bold tabular-nums">
                        {completedExecs.length > 0
                          ? (() => {
                              const delta = Math.round(
                                completedExecs.reduce(
                                  (sum, e) =>
                                    sum + ((e.outputScore ?? 0) - (e.inputScore ?? 0)),
                                  0,
                                ) / completedExecs.length,
                              )
                              return delta >= 0 ? `+${delta}` : `${delta}`
                            })()
                          : "--"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Workflow Configuration</CardTitle>
                <CardDescription>
                  Current settings for {workflow.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Workflow ID</p>
                      <p className="font-mono text-sm">{workflow.workflowId}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Weight Factor</p>
                      <p className="font-mono text-sm">{workflow.weight}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        {workflow.status === "active" ? (
                          <Play weight="fill" className="size-3 text-score-green" />
                        ) : (
                          <Pause weight="fill" className="size-3 text-score-yellow" />
                        )}
                        <span className="text-sm capitalize">{workflow.status}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                      <p className="text-sm">
                        {new Date(workflow.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{workflow.description}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Execution Environment</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Runtime</span>
                        <span className="font-mono">Chainlink CRE</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Network</span>
                        <span className="font-mono">{process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Base"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timeout</span>
                        <span className="font-mono">30s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Retries</span>
                        <span className="font-mono">3</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Workflow Alerts</CardTitle>
                <CardDescription>
                  Notifications triggered by this workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                {failedExecs.length > 0 ? (
                  <div className="space-y-3">
                    {failedExecs.slice(0, 5).map((exec) => (
                      <div
                        key={exec._id}
                        className="flex items-start gap-3 rounded-lg border border-score-red-border bg-score-red-bg p-3"
                      >
                        <XCircle weight="fill" className="size-4 text-destructive mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Execution Failed</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {exec.error ?? "Unknown error"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDate(exec.startedAt)}
                            {exec.agentAddress && (
                              <span className="font-mono">
                                {" "}-- {exec.agentAddress.slice(0, 6)}...{exec.agentAddress.slice(-4)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="size-8 text-score-green mb-2" />
                    <p className="text-sm font-medium">No alerts</p>
                    <p className="text-xs text-muted-foreground">
                      All recent executions completed successfully
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
