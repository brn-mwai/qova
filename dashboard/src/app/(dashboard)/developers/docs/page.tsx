"use client"

import { useState } from "react"
import {
  Code,
  Play,
  Copy,
  ArrowRight,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { toast } from "sonner"

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  description: string
  example: string
  response: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/agents/:address",
    description: "Get agent details including score, grade, and transaction stats",
    example: `curl -H "Authorization: Bearer qova_xxx" \\
  https://api.qova.cc/api/agents/0x742d...bD18`,
    response: `{
  "address": "0x742d...bD18",
  "score": 967,
  "grade": "AAA",
  "isRegistered": true,
  "totalTxCount": 156,
  "totalVolume": "45.2000 ETH"
}`,
  },
  {
    method: "POST",
    path: "/api/agents/register",
    description: "Register a new agent on-chain and begin score tracking",
    example: `curl -X POST -H "Authorization: Bearer qova_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"agent": "0x742d...bD18"}' \\
  https://api.qova.cc/api/agents/register`,
    response: `{
  "txHash": "0xabc...def",
  "agent": "0x742d...bD18"
}`,
  },
  {
    method: "POST",
    path: "/api/verify",
    description: "Verify an agent's trust score, sanctions, and registration status",
    example: `curl -X POST -H "Authorization: Bearer qova_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"agent": "0x742d...bD18"}' \\
  https://api.qova.cc/api/verify`,
    response: `{
  "agent": "0x742d...bD18",
  "verified": true,
  "score": 967,
  "grade": "AAA",
  "sanctionsClean": true,
  "isRegistered": true,
  "timestamp": "2026-02-28T14:30:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/scores/:address/history",
    description: "Get historical score snapshots for an agent",
    example: `curl -H "Authorization: Bearer qova_xxx" \\
  https://api.qova.cc/api/scores/0x742d...bD18/history?limit=30`,
    response: `{
  "agent": "0x742d...bD18",
  "snapshots": [
    { "score": 967, "grade": "AAA", "timestamp": "2026-02-28" },
    { "score": 963, "grade": "AAA", "timestamp": "2026-02-27" }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/badge/:address",
    description: "Get an SVG badge for an agent's current score (no auth required)",
    example: `# Embed in markdown:
![Qova Score](https://qova.cc/api/badge/0x742d...bD18)`,
    response: `<!-- Returns SVG image -->
<svg xmlns="http://www.w3.org/2000/svg" ...>
  qova score | AAA 967
</svg>`,
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET: "text-score-green border-score-green-border bg-score-green-bg",
  POST: "text-chart-2 border-chart-2/30 bg-chart-2/10",
  PUT: "text-score-yellow border-score-yellow-border bg-score-yellow-bg",
  DELETE: "text-destructive border-score-red-border bg-score-red-bg",
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text)
  toast.success("Copied to clipboard")
}

export default function ApiDocsPage(): React.ReactElement {
  const [activeEndpoint, setActiveEndpoint] = useState(0)
  const current = ENDPOINTS[activeEndpoint]

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <PageHeader
          breadcrumb="Developers"
          title="API Reference"
          subtitle="Explore and test the Qova API"
        />
      </div>

      {/* Quick Start */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Start</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-mono">Authentication</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('Authorization: Bearer qova_YOUR_API_KEY')}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              <code className="text-sm font-mono">
                Authorization: Bearer qova_YOUR_API_KEY
              </code>
              <p className="text-xs text-muted-foreground mt-3">
                All API requests (except badge) require authentication via Bearer token.
                Create a key in the <a href="/developers/keys" className="underline">API Keys</a> page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Endpoints */}
      <div className="px-4 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Endpoint List */}
          <div className="space-y-1">
            {ENDPOINTS.map((ep, i) => (
              <button
                key={ep.path}
                type="button"
                onClick={() => setActiveEndpoint(i)}
                className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                  i === activeEndpoint
                    ? "border-foreground/20 bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-[10px] ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </Badge>
                  <span className="font-mono text-xs truncate">{ep.path}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {ep.description}
                </p>
              </button>
            ))}
          </div>

          {/* Endpoint Detail */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={METHOD_COLORS[current.method]}>
                  {current.method}
                </Badge>
                <code className="font-mono text-sm">{current.path}</code>
              </div>
              <CardDescription>{current.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="request">
                <TabsList variant="line">
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-4">
                  <div className="relative rounded-lg border bg-muted/50 p-4">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(current.example)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <pre className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                      {current.example}
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent value="response" className="mt-4">
                  <div className="relative rounded-lg border bg-muted/50 p-4">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(current.response)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <pre className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                      {current.response}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
