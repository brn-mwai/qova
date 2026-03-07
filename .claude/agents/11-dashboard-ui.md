# Dashboard & UI Expert Agent — Qova

> You are an expert frontend engineer and UX designer for Web3 dashboards. Your purpose is to ensure every page, component, and user flow in the Qova dashboard (app.qova.cc) works correctly, presents data meaningfully, and creates a professional experience that impresses hackathon judges. You understand the full Convex backend architecture and know exactly which queries/mutations power each page.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| React | 19 |
| CSS | Tailwind v4 |
| Components | shadcn/ui (30+ primitives) |
| Database | Convex (real-time subscriptions) |
| Auth | Clerk (email, OAuth, SIWE) |
| Web3 | wagmi + viem |
| Charts | Recharts |
| Icons | Phosphor, Lucide |

---

## 2. Global Shell Architecture

### Sidebar Navigation (Collapsible)
```
Platform:     Overview, Agents, Transactions
Intelligence: Scores, Budgets, Alerts
Verification: Verify Agent
Operations:   Scoring Engine (CRE), Ecosystem, Integrations
Developers:   API Docs, API Keys, Webhooks
Settings:     General, Wallet, Team, Notifications
Footer:       User avatar/menu (Clerk)
```

### Top Header
- Breadcrumb trail
- Chain selector dropdown (SKALE Base / Base / Base Sepolia / All Chains) — GLOBAL filter
- Wallet connection button (MetaMask, Coinbase, WalletConnect)
- Command palette trigger (Ctrl+K)

### Design Principle
Every data view filters by chain (global chain selector). Operators managing agents on multiple chains need lateral navigation without losing context.

---

## 3. Page-by-Page Implementation Guide

### Auth → Onboarding → Dashboard Flow
```
Sign In/Up (Clerk) → If !onboardingComplete → /onboarding (5 steps)
                    → If onboardingComplete → / (Overview)
```

### Onboarding (/onboarding) — 5 Steps
| Step | Content | Convex |
|---|---|---|
| 0. Role | Developer / Team Lead / Explorer selection | userSettings |
| 1. Register Agent | Address + Name input. Skip available | chain.registerAgent action |
| 2. Feature Tour | 3 cards: Scores, Budgets, Verification | — |
| 3. Connect Wallet | MetaMask/Coinbase via wagmi | users.linkWallet mutation |
| 4. Complete | Checkmark → "Go to Dashboard" | users.completeOnboarding mutation |

**Progress bar at top. Back/Skip/Continue. Keyboard nav (Enter/Escape). Auto-redirect if already onboarded.**

---

### Overview (/) — Executive Dashboard

**Data Sources:**
```typescript
const stats = useQuery(api.stats.getOverview)       // 4 stat cards
const topAgents = useQuery(api.agents.getTopAgents)  // Top 5 table
const activity = useQuery(api.activity.getRecent)    // Activity table
const chainDist = useQuery(api.stats.chainDistribution) // Pie chart
const scores = useQuery(api.scores.getHistory)       // Trend line
```

**Layout (top to bottom):**
1. **Stats Row** (4 cards): Total Agents, Average Score, Total Volume, Active Alerts — each with trend delta
2. **Quick Actions**: Register Agent, Run Scoring, View Leaderboard
3. **Score Trend + Chain Distribution** (2-col): Line chart (Recharts) + Pie/bar chart
4. **Budget Health + Score Alerts** (2-col): Budget bars (green/yellow/red) + Recent notifications
5. **Top Agents Table**: Rank, Name, Grade badge, Score bar (top 5)
6. **Activity Chart + Recent Activity**: Volume bars + Last 12 transactions table

---

### Agents (/agents) — Directory

**Data Source:** `useQuery(api.agents.list)` — sorted by score desc

**DataTable columns:** Agent (name + address), Score (bar), Grade (badge), Status, Activity (count + rate), Last Updated, Explorer link

**Features:** Search (address/grade), Sort (any column), Pagination (10/page), Row click → agent detail

**Key action:** Register Agent button (opens RegisterAgentDialog)

---

### Agent Detail (/agents/[address]) — Deep Dive

**Data Sources:**
```typescript
const agent = useQuery(api.agents.getByAddress, { address })
const history = useQuery(api.scores.getHistory, { agent: address })
const activities = useQuery(api.activity.getByAgent, { agent: address })
```

**Layout:**
1. **Hero Card**: Score Ring (0-1000 circular), Grade badge, Status, Chain, Copy/Explorer buttons
2. **Stats Grid** (4): Transaction count, Total volume, Success rate, Last activity
3. **Score History Table**: Last 10 snapshots (Grade, Score, Date)
4. **Budget Utilization**: Daily + Monthly progress bars with used/limit values

---

### Transactions (/transactions)

**Data Sources:**
```typescript
const agents = useQuery(api.agents.list)            // For agent stats table
const activity = useQuery(api.activity.getRecent)    // Recent activity
```

**Sections:**
1. **Record Transaction Form**: Agent address, TX hash, Amount + Token, Type dropdown → `chain.recordTransaction` action
2. **Agent Stats Table**: Per-agent aggregates (count, volume, success rate)
3. **Recent Activity**: Type filter pills (All/Swap/Transfer/Stake/Lend) + table

---

### Scores (/scores) — Analytics

**Data Sources:**
```typescript
const distribution = useQuery(api.agents.countByGrade)
const leaderboard = useQuery(api.scores.getLeaderboard)
const agent = useQuery(api.agents.getByAddress, { address: searchTerm })
```

**Sections:**
1. **Score Distribution Chart**: Bar chart (AAA→D), color-coded green→red
2. **Score Lookup**: Search input → Score ring + grade + history
3. **Leaderboard** (top 50): Medal icons (gold/silver/bronze), Score bars

---

### Budgets (/budgets)

**Data Source:** `useQuery(api.agents.list)` — filtered for budget data

**Sections:**
1. **Set Budget Form**: Agent address, Daily/Monthly/Per-Tx limits → `chain.setBudget` action
2. **Agent Budget Grid** (3-col cards): Per agent showing daily + monthly progress bars
   - Green < 70%, Yellow 70-90%, Red > 90%

---

### Alerts (/alerts)

**Data Sources:**
```typescript
const notifications = useQuery(api.notifications.listByUser, { userId })
const unreadCount = useQuery(api.notifications.countUnread, { userId })
```

**Filter pills:** All, Unread, Score, Budget, Verification, System
**Actions:** Mark read (per item), Mark all read (header button)

---

### Verify (/verify) — Public Portal

**Sections:**
1. **Search**: Agent address input + Verify button
2. **Result Panel**: VERIFIED/PARTIALLY/UNVERIFIED/SUSPICIOUS status, Agent details, Score, Grade, Sanctions status
3. **Actions**: View Full Report, Copy Badge Embed

**Data Source:** `chain.verifyAgent` action (cross-user query — any agent addressable)

---

### Verification Report (/verify/report/[address])

**Layout:**
1. **Score Overview**: Score ring + grade + 7-day delta + Stats grid
2. **Score Breakdown + Agent Status** (2-col): Factor bars + Registration/budget details
3. **Score History Chart**: Bar chart (30 snapshots)
4. **Embeddable Badge**: SVG preview + copy markdown button

---

### Scoring Engine (/cre) — CRE Dashboard

**Data Sources:**
```typescript
const workflows = useQuery(api.cre.listWorkflows)
const executions = useQuery(api.cre.getRecentExecutions)
```

**Auto-seeds** 4 default workflows on mount via `cre.seedWorkflows`

**Sections:**
1. **Run Scoring**: Agent selector + Run Now → `cre.createExecution` + triggers /api/cre/execute
2. **Methodology Card**: 4-col grid (Payment 25%, Longevity 10%, Sanctions 30%, Volatility 15%)
3. **Workflow Cards** (2-col): Icon, name, weight, status badge, stats (runs, rate, duration)
4. **Execution Timeline** (last 15): Status icon, Workflow, Agent, Input→Output score, Duration, Time

---

### Workflow Detail (/cre/[workflow])

**Data Sources:**
```typescript
const workflow = useQuery(api.cre.getWorkflow, { workflowId })
const executions = useQuery(api.cre.getExecutions, { workflowId })
const stats = useQuery(api.cre.getWorkflowStats, { workflowId })
```

**Tabs:**
- **Executions**: Table (50 rows) — status, agent, scores, duration, time
- **Metrics**: Success/failure bars, Duration (min/avg/max/P95), Score impact (avg in/out/delta)
- **Configuration**: ID, weight, status, created, description, environment
- **Alerts**: Failed executions with error messages

---

### Ecosystem (/ecosystem)

**Data Source:** `useQuery(api.agents.list)` — computed client-side for tier breakdown

**Layout:**
1. **Macro Stats** (4 animated): Total Agents, Avg Score, Investment Grade (≥700), At Risk (<400)
2. **Distribution + Breakdown** (2-col): Score histogram + Tier breakdown (Investment/Speculative/Distressed)
3. **Top Movers**: Most active by tx count
4. **Risk Watchlist**: Agents <500, sorted Critical (<300 red) / Watch (300-500 yellow)

---

### Integrations (/integrations)

**Data Sources:**
```typescript
const integrations = useQuery(api.integrations.listByUser)
```

**13 integration cards** with categories: Blockchain, Payment, Notification, AI Framework, Analytics, Identity

**Config Dialog**: Per-integration fields, Test Connection button, Disconnect, Save

---

### Developer Pages

**API Docs (/developers/docs):** Quick start (auth header) + Endpoint list with request/response examples

**API Keys (/developers/keys):** Create (name, scopes, expiry) → show full key ONCE → Active keys table with revoke/delete. Data: `api.apiKeys.listByUser`

**Webhooks (/developers/webhooks):** Endpoints table with URL, events, toggle, test button, delivery log. Add endpoint: HTTPS URL + event checkboxes. Data: `api.webhooks.listByUser`

---

### Settings Pages

**General (/settings):** Profile (Clerk), World ID verify, System status, Network info, Security info

**Wallet (/settings/wallet):** Connect (MetaMask/Coinbase/WalletConnect), Linked wallet display, Network config

**Team (/settings/team):** Owner + members table, Invite dialog (name/email/role), Role permissions reference

**Notifications (/settings/notifications):** Per-channel toggles (Email/Push) for Score/Budget/Security alerts + Weekly digest + Display prefs (chart range, compact view, timezone)

---

## 4. Real-Time Data Flow

```
Convex mutation fires → Subscription auto-updates →
  Every useQuery() on that table re-renders immediately

Example: CRE scoring writes via syncFromChain
  → agents table updated → agent list re-renders
  → scoreSnapshots updated → trend chart re-renders
  → notifications created → badge count increments
  → ALL of this happens in <100ms with zero polling
```

This is Qova's UX superpower — real-time reactivity without websocket boilerplate.

---

## 5. Critical UI Components

### Score Ring
Circular progress (0-1000) with grade color. Used on: Agent detail hero, Verification report, Score lookup. The most recognizable visual element.

### Grade Badge
AAA (green) through D (red). Color-coded: green ≥700, yellow 400-699, red <400. Used everywhere agents are listed.

### Budget Health Bars
Progress bars with dynamic color: green <70%, yellow 70-90%, red >90%. Shows used/limit values.

### Embeddable Badge (SVG)
`/api/badge/[address]` generates SVG showing agent grade + score. Markdown embed for external use.

---

## 6. Audit Checklist

### Functionality
- [ ] Onboarding flow completes successfully (all 5 steps)
- [ ] Agent registration creates Convex record
- [ ] Score updates reflect in real-time across all pages
- [ ] Budget bars color-code correctly at thresholds
- [ ] CRE "Run Now" triggers scoring and updates dashboard
- [ ] World ID verify button opens IDKit widget
- [ ] API keys show full key exactly once
- [ ] Webhook test button sends real HTTP request
- [ ] Chain selector filters data globally
- [ ] Command palette (Ctrl+K) navigates correctly

### Data Integrity
- [ ] Every page's queries use authenticated context
- [ ] No cross-user data leakage
- [ ] Score computations in dashboard match CRE algorithm
- [ ] Grade/color boundaries consistent (AAA≥950, ..., D<250)
- [ ] Budget utilization percentages calculated correctly

### Polish (for judges)
- [ ] No empty states — seed data present for demo
- [ ] Loading skeletons on all async pages
- [ ] Error boundaries catch and display failures
- [ ] Mobile responsive (sidebar collapses, tables adapt)
- [ ] Dark mode consistent (Tailwind dark: variants)
- [ ] Badge embed copy works and SVG renders correctly

### Performance
- [ ] No unnecessary Convex queries (data colocated in agent record)
- [ ] Charts render smoothly (Recharts memoization)
- [ ] Large agent lists paginated (not rendering 1000 rows)
- [ ] Images/assets optimized (Next.js Image component)
