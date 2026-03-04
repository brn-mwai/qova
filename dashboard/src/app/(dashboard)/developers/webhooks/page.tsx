"use client"

import { useState } from "react"
import {
  WebhooksLogo,
  Plus,
  Trash,
  CheckCircle,
  XCircle,
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
import { PageHeader } from "@/components/shared/page-header"
import { toast } from "sonner"

const WEBHOOK_EVENTS = [
  "agent.registered",
  "agent.score_updated",
  "agent.verified",
  "budget.exceeded",
  "budget.warning",
  "transaction.completed",
]

interface WebhookEntry {
  id: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: string
  lastDelivery: { success: boolean; timestamp: string } | null
}

const DEMO_WEBHOOKS: WebhookEntry[] = [
  {
    id: "1",
    url: "https://api.example.com/webhooks/qova",
    events: ["agent.score_updated", "agent.verified"],
    isActive: true,
    createdAt: "2026-01-20",
    lastDelivery: { success: true, timestamp: "2026-02-28T14:30:00Z" },
  },
  {
    id: "2",
    url: "https://hooks.slack.com/services/T00/B00/xxx",
    events: ["budget.exceeded", "budget.warning"],
    isActive: true,
    createdAt: "2026-02-05",
    lastDelivery: { success: false, timestamp: "2026-02-27T09:15:00Z" },
  },
]

export default function WebhooksPage(): React.ReactElement {
  const [webhooks] = useState<WebhookEntry[]>(DEMO_WEBHOOKS)
  const [createOpen, setCreateOpen] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  function toggleEvent(event: string): void {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    )
  }

  function handleCreate(): void {
    if (!newUrl.trim() || selectedEvents.length === 0) return
    toast.success("Webhook created successfully")
    setCreateOpen(false)
    setNewUrl("")
    setSelectedEvents([])
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <PageHeader
          breadcrumb="Developers"
          title="Webhooks"
          subtitle="Real-time event notifications for your applications"
          actions={
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-1" />
                  Add Endpoint
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Webhook Endpoint</DialogTitle>
                  <DialogDescription>
                    Configure a URL to receive event notifications.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Endpoint URL</Label>
                    <Input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://api.example.com/webhooks"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Events</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {WEBHOOK_EVENTS.map((event) => (
                        <button
                          key={event}
                          type="button"
                          onClick={() => toggleEvent(event)}
                          className={`rounded-md border px-3 py-2 text-left text-xs font-mono transition-colors cursor-pointer ${
                            selectedEvents.includes(event)
                              ? "border-foreground bg-accent"
                              : "hover:bg-accent/50"
                          }`}
                        >
                          {event}
                        </button>
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
                    disabled={!newUrl.trim() || selectedEvents.length === 0}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Endpoints</CardTitle>
            <CardDescription>
              {webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 text-xs">URL</TableHead>
                  <TableHead className="text-xs">Events</TableHead>
                  <TableHead className="text-xs">Last Delivery</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="pr-6 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <WebhooksLogo className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs truncate max-w-[200px]">
                          {wh.url}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <Badge key={ev} variant="outline" className="text-[10px]">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {wh.lastDelivery ? (
                        <div className="flex items-center gap-1.5">
                          {wh.lastDelivery.success ? (
                            <CheckCircle weight="fill" className="size-3.5 text-score-green" />
                          ) : (
                            <XCircle weight="fill" className="size-3.5 text-destructive" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(wh.lastDelivery.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          wh.isActive
                            ? "text-score-green border-score-green-border bg-score-green-bg"
                            : "text-muted-foreground"
                        }
                      >
                        {wh.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-muted-foreground hover:text-destructive"
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
    </div>
  )
}
