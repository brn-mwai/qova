# Qova Demo Narration (2 Minutes)

> Belief-driven. Track-focused. CLI-first. Every claim backed by code.

---

## 0:00 - 0:20 -- Belief (The Why)

**Narration:**
"We believe AI agents will manage more capital than most humans. Trading, lending, bridging - autonomously. But right now, there is no way to know which agent you can trust. No credit history. No track record. No accountability. We built Qova because we believe trust should be earned on-chain, scored by a decentralized network, and verified by code - not by a company."

### Visual Direction

**Layout:** Full-screen dashboard at app.qova.cc, slowly zooming in.

| Timestamp | What's On Screen | Annotation |
|:----------|:----------------|:-----------|
| 0:00 | Dashboard overview - dark theme, score summary cards across the top (total agents, average score, active alerts), activity feed scrolling on the right | Fade in from black. No annotations yet - let the UI speak. |
| 0:05 | Camera pans down to the agent list below - rows showing agent addresses, score rings (color-coded by grade), last activity timestamps | Subtle glow on score rings to draw attention. |
| 0:10 | Click into an agent detail page - score history chart (line chart trending upward), transaction log table, budget utilization bar | Text overlay bottom-left: **"app.qova.cc"** in JetBrains Mono, white on dark. |
| 0:15 | Quick cut: the score ring fills from 0 to 750, grade label shifts from D to BBB with color change (red to green) | This is the "aha" moment - scores are dynamic, earned, verifiable. |

**Transition:** Hard cut to split-screen (terminal left, dashboard right).

---

## 0:20 - 0:50 -- Track 1: CRE & AI (Reputation Oracle)

**Narration:**
"Here is how it works. Every ten minutes, a CRE cron trigger fires. The workflow reads three smart contracts on Base - Reputation Registry, Transaction Validator, Budget Enforcer. Then each D.O.N. node independently calls Groq's Llama 3.1 70B to analyze the agent's behavior. They reach consensus via median aggregation. The final score blends traditional metrics at eighty-five percent with the AI risk assessment at fifteen percent. All BigInt math. Deterministic across nodes. Written on-chain."

### Visual Direction

**Layout:** Split-screen. Terminal (left 55%, dark background, font size 18). Dashboard CRE monitoring page (right 45%).

| Timestamp | Terminal (Left) | Dashboard (Right) | Annotation |
|:----------|:----------------|:------------------|:-----------|
| 0:20 | Type: `cd C:/Users/Windows/qova/cre` then Enter | CRE workflow list page - 4 workflow cards: Reputation Oracle (cron icon), Transaction Monitor (event icon), Budget Alert (shield icon), Agent Verify (checkmark icon). Reputation Oracle card has a green "Active" indicator. | Arrow annotation pointing to terminal: **"CRE CLI"** |
| 0:23 | Type: `cre workflow simulate reputation-oracle --target staging-settings` then Enter | Reputation Oracle card pulses/highlights | Box annotation on terminal: **"Cron trigger: every 10 minutes"** |
| 0:27 | Logs begin streaming: `Reading contracts: ReputationRegistry, TransactionValidator, BudgetEnforcer` | Dashboard shows "Executing..." spinner on the workflow card | Highlight the 3 contract names in yellow in the terminal |
| 0:32 | Log: `AI-enhanced scoring for agent: 0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158` | Agent detail page loads on right - showing the agent's current score | Callout: **"Groq Llama 3.1 70B via runInNodeMode"** |
| 0:37 | Log: `AI analysis: risk=22, confidence=85, flags=["consistent_performer"]` | Score chart on right shows a pending update dot | Highlight "risk=22" and "confidence=85" in green |
| 0:42 | Log: `Score breakdown: traditional=680, aiAdjustment=780, final=695` | Score ring on right animates from old value to 695, grade label updates | Callout: **"85% traditional + 15% AI = final score"** |
| 0:47 | Log: `Score written on-chain: 0x0a3AF9... -> 695` | Score chart adds the new data point, line extends | Flash green confirmation on the terminal log line |

**Transition:** Terminal clears. Dashboard slides to alerts page.

---

## 0:50 - 1:20 -- Track 2: Risk & Compliance (Transaction Monitor + Budget Alert)

**Narration:**
"Scheduled scoring is one layer. But when something suspicious happens, CRE reacts in real-time. Our transaction monitor listens for TransactionRecorded events via an EVM Log trigger. When one fires, it computes anomaly risk across three factors - large value spikes at thirty percent, failure rate at forty, and frequency at thirty. An agent that normally moves a hundred dollars suddenly pushing fifty thousand gets flagged, even though that amount is normal for other agents. A score above seventy-five means an automatic penalty written on-chain. Our budget alert workflow does the same for spending. SpendRecorded event fires, CRE reads utilization, classifies it - green, yellow, red, or critical. Critical means a score penalty. No server involved."

### Visual Direction

**Layout:** Same split-screen. Terminal left, dashboard alerts page right.

| Timestamp | Terminal (Left) | Dashboard (Right) | Annotation |
|:----------|:----------------|:------------------|:-----------|
| 0:50 | Type: `cre workflow simulate transaction-monitor --target staging-transaction-monitor` then Enter | Alerts page - currently showing a few green/yellow entries | Callout: **"EVM Log trigger: TransactionRecorded"** |
| 0:55 | Log: `Transaction detected: agent=0x..., tx=0x...` | A new row starts appearing at the top of the alerts list | Arrow from terminal to dashboard: **"real-time event"** |
| 1:00 | Log: `Anomaly: agent=0x..., risk=78, severity=CRITICAL` | Alert row fills in: red severity badge, risk score "78/100", agent address | Highlight "risk=78" and "CRITICAL" in red. Callout: **"4-factor anomaly detection"** |
| 1:05 | Log: `Report written on-chain for agent 0x...` | Score on dashboard updates downward (penalty applied). Red flash on the score ring. | Callout: **"Automatic score penalty"** |
| 1:08 | Blank line, then type: `cre workflow simulate budget-alert --target staging-budget-alert` then Enter | Dashboard stays on alerts, waiting | Callout: **"EVM Log trigger: SpendRecorded"** |
| 1:12 | Log: `Spend recorded for agent: 0x...` | New budget alert row begins appearing | -- |
| 1:15 | Log: `Budget: agent=0x..., daily=9200bps, monthly=7500bps, level=RED` | Budget alert row fills: amber/red badge, "92% daily utilization", progress bar nearly full | Callout: **"GREEN < 70% < YELLOW < 90% < RED < 100% < CRITICAL"** shown as a colored scale bar |
| 1:18 | Log: `Budget report written on-chain for agent 0x...` | Alert list now shows both: anomaly (red) and budget (amber) alerts stacked | -- |

**Transition:** Terminal clears. Dashboard slides to verify page.

---

## 1:20 - 1:45 -- Track 3: World ID with CRE (Agent Verification)

**Narration:**
"The last track ties identity to trust. An operator sends their agent address to CRE via HTTP trigger. The workflow reads three contracts, runs five verification checks - registration status, transaction activity, account activity, budget configuration, and minimum score. The output is a classification: Verified, Partially Verified, or Unverified. With a credit grade from triple-A down to D. The attestation is written on-chain through our consumer contract. And World ID nullifier tracking ensures one human, one verified agent. Decentralized sybil resistance - no server in the loop."

### Visual Direction

**Layout:** Split-screen. Terminal left, dashboard verify page right.

| Timestamp | Terminal (Left) | Dashboard (Right) | Annotation |
|:----------|:----------------|:------------------|:-----------|
| 1:20 | Type: `cre workflow simulate agent-verify --target staging-agent-verify` then Enter | Verify page showing an agent address input field and a "Verify with World ID" button. Below: empty verification results area. | Callout: **"HTTP trigger"** |
| 1:24 | Log: `Verifying agent: 0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158` | Agent address appears in the input field. Loading spinner starts. | -- |
| 1:28 | Log lines streaming: check results appearing one by one | On the right, a verification checklist appears with 5 items. Each item ticks green as the corresponding log appears: Registration (check), Activity (check), Active Status (check), Budget Config (check), Min Score (check) | Callout: **"5 on-chain verification checks"** |
| 1:35 | Log: `Verification: agent=0x..., status=VERIFIED, grade=BBB, passed=5/5` | Big "VERIFIED" badge appears with green checkmark. Credit grade "BBB" shown in a card beside it. Score: 695. | Highlight "VERIFIED" and "BBB" in green |
| 1:38 | Log: `Verification written on-chain: 0x... -> VERIFIED` | A "View on BaseScan" link appears under the verification result. World ID logo visible next to the verified badge. | Callout: **"On-chain attestation"** |
| 1:42 | Terminal shows the full JSON output: `{"status":"VERIFIED","grade":"BBB","passedChecks":"5","totalChecks":"5",...}` | Verification report page loads: full breakdown with all 5 checks, score components, credit grade card | -- |

**Transition:** Fade terminal out. Dashboard goes full-screen briefly.

---

## 1:45 - 2:00 -- Close (Belief Restated)

**Narration:**
"Four CRE workflows. Three trigger types - cron, EVM log, HTTP. AI-enhanced scoring. Decentralized verification. Four smart contracts on Base. A TypeScript SDK. A REST API. And a full dashboard at app dot qova dot cc. We believe every agent should earn its reputation. Qova makes that real. Built by Hausor Labs."

### Visual Direction

| Timestamp | What's On Screen | Annotation |
|:----------|:----------------|:-----------|
| 1:45 | Dashboard CRE monitoring page - all 4 workflow cards visible, each showing "Last run" timestamps and green status indicators | Quick montage cuts (0.5s each): Dashboard overview -> Agent list -> Score chart -> Alerts -> Verify page -> CRE monitoring |
| 1:50 | Architecture diagram (from README mermaid) showing the full flow: Agents -> SDK -> Smart Contracts -> CRE Network -> Score Consumers | Text overlay: **"4 workflows - 3 triggers - 4 contracts"** |
| 1:53 | SDK code snippet on a dark code editor background: `const { score, grade } = await client.getScore("0x...")` | Text overlay: **"3 lines to check any agent's credit"** |
| 1:56 | End card fades in - dark background, Qova logo centered | Below logo: **app.qova.cc** and **qova.cc** |
| 1:58 | GitHub URL and team names fade in below | **github.com/brn-mwai/qova** / **Brian Mwai & Joy C. Lang'at** / **Hausor Labs** |
| 2:00 | Hold end card | -- |

---

## Track Coverage Map

| Time | Content | Prize Track |
|:-----|:--------|:------------|
| 0:20-0:50 | Groq Llama 3.1 70B in runInNodeMode, ConsensusAggregationByFields, median aggregation | CRE & AI ($10,500) |
| 0:50-1:20 | EVM Log triggers, anomaly detection, budget enforcement, score penalties | Risk & Compliance ($10,000) |
| 1:20-1:45 | HTTP trigger, 5 verification checks, credit grades, nullifier sybil resistance | World ID with CRE ($3,000) |
| Full video | 4 workflows, 3 trigger types, 6-package monorepo, full-stack platform | Top 10 ($1,500) |

---

## What Is Verifiable In Code

Every claim in this script maps to actual source files:

| Claim | Source |
|:------|:-------|
| Cron every 10 minutes | `cre/project.yaml` line 9: `schedule: "0 */10 * * * *"` |
| Reads 3 contracts | `cre/reputation-oracle/main.ts` lines 166-244: getScore, getTransactionStats, getBudgetStatus |
| Groq Llama 3.1 70B | `cre/reputation-oracle/main.ts` line 127: `model: "llama-3.1-70b-versatile"` |
| runInNodeMode + consensus | `cre/reputation-oracle/main.ts` lines 313-320: `runtime.runInNodeMode(analyzeAgentBehavior, ConsensusAggregationByFields)` |
| 85% traditional + 15% AI | `cre/reputation-oracle/main.ts` lines 331-333: `(traditionalScore * 8500n) / 10000n + (aiAdjustment * 1500n) / 10000n` |
| BigInt math only | All scoring uses `BigInt` - no floats anywhere in CRE workflows |
| EVM Log trigger (TransactionRecorded) | `cre/transaction-monitor/main.ts` lines 210-220: `evmClient.logTrigger(logTriggerConfig(...))` |
| 3-factor anomaly (30/40/30 weights) | `cre/transaction-monitor/main.ts` line 143: `(largeValueRisk * 30n + failureRisk * 40n + frequencyRisk * 30n) / 100n` |
| EVM Log trigger (SpendRecorded) | `cre/budget-alert/main.ts` lines 197-205: `evmClient.logTrigger(logTriggerConfig(...))` |
| GREEN/YELLOW/RED/CRITICAL thresholds | `cre/budget-alert/main.ts` lines 45-53: 7000n, 9000n, 10000n basis points |
| HTTP trigger for verification | `cre/agent-verify/main.ts` lines 258-271: `http.trigger(triggerConfig)` |
| 5 verification checks | `cre/agent-verify/main.ts` lines 173-202: registered, hasActivity, isActive, hasBudget, score >= 100 |
| Credit grades AAA-D | `cre/agent-verify/main.ts` lines 47-55: `computeGrade()` function |
| 4 contracts on Base Sepolia | `cre/project.yaml`: deployed addresses with `ethereum-testnet-sepolia-base-1` |

---

## Recording Checklist

1. **Resolution**: 1920x1080, terminal font size 18+, dashboard zoom 100%
2. **Layout**: Split-screen - terminal left (55%), dashboard right (45%)
3. **Terminal**: Dark theme, high-contrast. Clear between sections.
4. **Browser**: Incognito mode, dark theme, no bookmarks bar
5. **Pre-flight**: Run all 4 simulations once before recording to verify they work
6. **Annotations**: Use screen recording software (OBS, ScreenFlow) to add callout boxes and arrows in post
7. **Timing**: Practice the narration with a timer - 2 minutes is tight, aim for 1:55 to leave breathing room
8. **Pacing**: Pause 1 second after each CLI command before hitting Enter (lets viewer read the command)
9. **Dashboard data**: Seed demo data before recording (`npx convex run mutations/seed:seedDemoData`)

---

## ElevenLabs Settings

Recommended voice: Adam or Rachel
Stability: 0.55
Clarity: 0.78
Style: 0.15
Speed: Slightly below default

Pronunciation guide:
- CRE: C. R. E.
- DON: D. O. N.
- Qova: koh-vah
- Groq: rhymes with rock
- BigInt: big int (two words)
- Llama: lah-mah
- runInNodeMode: run in node mode
- SDK: S. D. K.
- EVM: E. V. M.
- API: A. P. I.
- DeFi: dee-fie
- Hausor: how-soar
- qova dot cc: koh-vah dot see see
- sybil: sib-ill
- bps: basis points
