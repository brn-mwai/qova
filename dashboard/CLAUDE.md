# Dashboard -- Development Protocol

> Source of truth: `.claude/agents/11-dashboard-ui.md` (342 lines)

## Stack
Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui, Convex (real-time DB), Clerk (auth), wagmi + viem (Web3), Recharts (charts), Phosphor Icons

## Design System
- Colors: Black/White base. Yellow (#FACC15) warning/CTA. Red (#EF4444) errors. Green (#22C55E) success only.
- Fonts: Inter (UI), JetBrains Mono (scores, numbers, addresses)
- Dark mode FIRST
- Icons: Phosphor regular weight default, fill for active

## Page-to-Query Mapping

| Page | Convex Queries |
|---|---|
| Overview `/` | `stats.getOverview`, `agents.getTopAgents`, `activity.getRecent`, `stats.chainDistribution` |
| Agents `/agents` | `agents.list` |
| Agent Detail `/agents/[address]` | `agents.getByAddress`, `scores.getHistory`, `activity.getByAgent` |
| Transactions `/transactions` | `agents.list`, `activity.getRecent` |
| Scores `/scores` | `agents.countByGrade`, `scores.getLeaderboard`, `agents.getByAddress` |
| Budgets `/budgets` | `agents.list` (filtered for budget data) |
| Alerts `/alerts` | `notifications.listByUser`, `notifications.countUnread` |
| Verify `/verify` | `chain.verifyAgent` action |
| CRE `/cre` | `cre.listWorkflows`, `cre.getRecentExecutions` |
| CRE Detail `/cre/[workflow]` | `cre.getWorkflow`, `cre.getExecutions`, `cre.getWorkflowStats` |
| Ecosystem `/ecosystem` | `agents.list` (computed client-side) |
| Integrations `/integrations` | `integrations.listByUser` |
| API Keys `/developers/keys` | `apiKeys.listByUser` |
| Webhooks `/developers/webhooks` | `webhooks.listByUser` |
| Settings `/settings` | `users.getUser` |
| Notifications `/settings/notifications` | `settings.getSettings` |

## Key Components

- **Score Ring**: Circular progress 0-1000 with grade color. Used in agent detail, verify report, score lookup.
- **Grade Badge**: AAA-D. Green >= 700, Yellow 400-699, Red < 400.
- **Budget Bars**: Progress bars. Green < 70%, Yellow 70-90%, Red > 90%.
- **Embeddable Badge**: `/api/badge/[address]` generates SVG.

## Real-Time Data Flow

```
Convex mutation fires
  -> All useQuery() subscriptions on affected tables re-render immediately
  -> No polling, no WebSocket boilerplate
  -> <100ms latency

Example: CRE scoring writes via syncFromChain
  -> agents table updated -> agent list re-renders
  -> scoreSnapshots updated -> trend chart re-renders
  -> notifications created -> badge count increments
```

## World ID Integration

Widget uses `@worldcoin/idkit` with `IDKitWidget` component. Proof is submitted via `worldId.verifyWorldId` mutation. Stores nullifierHash for sybil resistance.

## Seed Data

`seedDemoData()` creates 10 agents, 90 days of score history, 60 activities, 40 CRE executions, 5 notifications. Idempotent (checks for existing agents). Required for demo.

## Audit Checklist

- [ ] Onboarding flow completes (all 5 steps)
- [ ] Agent registration creates Convex record
- [ ] Score updates reflect in real-time
- [ ] Budget bars color correctly at thresholds
- [ ] CRE "Run Now" triggers scoring
- [ ] Chain selector filters globally
- [ ] API keys shown once, then masked
- [ ] Webhook test sends real HTTP
- [ ] No empty states (seed data present)
- [ ] Loading skeletons on all async pages
- [ ] Mobile responsive
