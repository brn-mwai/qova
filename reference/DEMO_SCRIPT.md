# Qova Demo Video Script (4 minutes)

> Target: Chainlink Block Magic 2025 hackathon judges. Hit ALL four prize tracks.

---

## 0:00 - 0:30 -- Hook & Problem Statement

**Narration:**
"As autonomous AI agents increasingly execute financial transactions, there's no standardized way to assess their trustworthiness. Qova is a decentralized credit bureau for AI agents, powered by Chainlink CRE. Think Equifax, but for AI."

**Screen:** Dashboard overview at app.qova.cc showing score distribution, agent count, recent activity feed.

**Terminal commands to pre-record:**
```bash
# Open dashboard in browser
open https://app.qova.cc
```

---

## 0:30 - 1:15 -- CRE & AI Track: Reputation Oracle

**Narration:**
"Every 10 minutes, our CRE workflow reads agent data from three on-chain contracts, sends it to Groq's Llama 3.1 70B for behavioral analysis inside runInNodeMode, then all DON nodes reach consensus on the AI-enhanced score and write it back on-chain."

**Screen:** Split - terminal left, dashboard right.

**Terminal commands:**
```bash
cd C:/Users/Windows/qova/cre

# Simulate the reputation oracle workflow
"C:/Users/Windows/AppData/Local/Programs/cre/cre.exe" workflow simulate reputation-oracle --target staging-settings
```

**What to highlight in logs:**
1. "Reading contracts: ReputationRegistry, TransactionValidator, BudgetEnforcer"
2. "AI enrichment via Groq Llama 3.1 70B" (runInNodeMode HTTP call)
3. "Consensus reached across DON nodes"
4. "5-factor weighted score: successRate(30%) + volume(25%) + count(20%) + budget(15%) + age(10%)"
5. "writeReport() -> score written on-chain"

**Dashboard:** Show score ring updating in real-time on the agents page.

---

## 1:15 - 2:00 -- Risk & Compliance Track: Transaction Monitor + Budget Alert

**Narration:**
"When an agent executes a suspicious transaction, CRE reacts instantly. Our transaction monitor uses 4-factor anomaly detection - frequency spikes, large values, failure rates, and flagged contracts. And our budget enforcer catches agents approaching spending limits before they breach."

**Screen:** Split - terminal left, dashboard right.

**Terminal commands:**
```bash
# Simulate transaction monitor (EVM Log trigger)
"C:/Users/Windows/AppData/Local/Programs/cre/cre.exe" workflow simulate transaction-monitor --target staging-settings

# Simulate budget alert (EVM Log trigger)
"C:/Users/Windows/AppData/Local/Programs/cre/cre.exe" workflow simulate budget-alert --target staging-settings
```

**What to highlight in logs:**
1. Transaction monitor: "EVM Log trigger: TransactionRecorded event detected"
2. "Anomaly risk score: 78/100 - FLAGGED"
3. "Score penalty applied: -50 points"
4. Budget alert: "SpendRecorded event -> utilization at 92% -> CRITICAL alert"
5. "Enforcement action: score penalty + webhook notification"

**Dashboard:** Show alerts page with new anomaly and budget warnings appearing.

---

## 2:00 - 2:45 -- World ID with CRE Track: Agent Verification

**Narration:**
"Agent operators verify their humanity through World ID, but the verification is orchestrated by CRE - not our server. The proof is sent to CRE via HTTP trigger, DON nodes independently verify it against the World ID API, reach consensus, and write the result on-chain. Fully decentralized sybil resistance."

**Screen:** Split - dashboard left showing verify page, terminal right.

**Terminal commands:**
```bash
# Simulate agent verification (HTTP trigger with World ID proof)
"C:/Users/Windows/AppData/Local/Programs/cre/cre.exe" workflow simulate agent-verify --target staging-settings
```

**What to highlight in logs:**
1. "HTTP trigger received: World ID proof for agent 0x..."
2. "Verifying proof against World ID API (consensus across DON nodes)"
3. "8 verification checks: registration, contract existence, account age, owner consistency, activity level, ownership stability, sanctions, minimum score"
4. "Result: VERIFIED - credit grade A"
5. "writeReport() -> verification status on-chain"

**Dashboard:** Click "Verify with World ID" button, show the IDKit widget, then show the verified badge appearing after CRE processes.

---

## 2:45 - 3:15 -- Architecture & SKALE Dual-Chain Design

**Narration:**
"Qova runs a dual-chain architecture. CRE workflows settle on Base Sepolia where Chainlink's KeystoneForwarder lives. But agent day-to-day transactions happen on SKALE on Base - zero gas fees mean high-frequency score updates are economically viable. Agents can pay for premium reputation lookups using x402 micropayments settled on SKALE."

**Screen:** Show architecture diagram (from README or a prepared slide).

```
Architecture Overview:

Dashboard (app.qova.cc)
    |
    v
CRE Workflows (4 workflows, 3 trigger types)
    |
    v
Smart Contracts
    |--- Base Sepolia: CRE settlement (KeystoneForwarder)
    |    - QovaReputationConsumer (CRE report receiver)
    |    - QovaVerificationConsumer (World ID CRE receiver)
    |
    |--- SKALE on Base: Zero-gas agent transactions
         - ReputationRegistry (gas-free score reads)
         - TransactionValidator (gas-free tx recording)
         - BudgetEnforcer (gas-free budget checks)
```

**Highlight:**
- 4 CRE workflows covering 3 trigger types (Cron, EVM Log, HTTP)
- AI integration (Groq Llama 3.1 70B) in runInNodeMode
- World ID sybil resistance via CRE
- SKALE zero-gas for agent operations
- x402 payment protocol for agent-to-agent micropayments

---

## 3:15 - 3:45 -- SDK Quick Demo

**Narration:**
"Any protocol can check an agent's Qova score with three lines of code."

**Screen:** Show code snippet.

```typescript
import { createQovaClient } from "@brnmwai/qova-core";

const client = createQovaClient({ chain: "base-sepolia" });
const { score, grade } = await client.getScore("0xAgentAddress...");
// => { score: 750, grade: "BBB", color: "#22C55E" }
```

**Show:** CRE page in dashboard with all 4 workflow execution histories visible.

---

## 3:45 - 4:00 -- Close

**Narration:**
"Qova - financial trust infrastructure for the agentic economy. Four CRE workflows, AI-enhanced scoring, World ID verification, dual-chain with SKALE, and a full SDK. Built by Hausor Labs."

**Screen:** Show qova.cc website, GitHub repo link, team.

**End card:**
- GitHub: github.com/brn-mwai/qova
- Dashboard: app.qova.cc
- Team: Brian Mwai & Joy C. Lang'at - Hausor Labs
- brian@hausorlabs.tech | joy@hausorlabs.tech

---

## Track Coverage Summary

| Timestamp | Content | Prize Track |
|:----------|:--------|:------------|
| 0:30-1:15 | AI API (Groq Llama 3.1 70B) in CRE runInNodeMode + reputation scoring | CRE & AI ($10,500) |
| 1:15-2:00 | Anomaly detection + budget enforcement via CRE EVM Log triggers | Risk & Compliance ($10,000) |
| 2:00-2:45 | World ID proof verification orchestrated by CRE, written to Base | World ID with CRE ($3,000) |
| Full video | 4 CRE workflows, 3 trigger types, full-stack architecture | Top 10 ($1,500) |

---

## Recording Tips

1. **Resolution**: 1920x1080 minimum, font size 16+ in terminal
2. **Layout**: Split screen - terminal left, dashboard right
3. **Pre-flight**: Run all 4 simulations once before recording to ensure they work
4. **Timing**: Practice narration with a timer - 4 minutes is tight
5. **Annotations**: Use colored terminal output or screen annotations to highlight CRE-specific log lines
6. **Browser**: Clear browser history, use incognito mode for clean dashboard
7. **Wallet**: Pre-fund test wallets so no transaction failures during recording
