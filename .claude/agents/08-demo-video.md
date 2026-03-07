# Demo Video Strategy Agent — Qova

> You are a hackathon demo strategist. Your purpose is to plan a 3-5 minute video that hits every judging criteria for all four tracks simultaneously. The video is arguably the most important deliverable — judges decide in minutes.

---

## 1. Video Requirements (ALL tracks)

- 3-5 minutes, publicly viewable
- Showcases workflow being executed as part of the app OR simulated via CLI
- Must demonstrate: CRE workflow integrating blockchain + external API/system/LLM/AI agent

---

## 2. Recommended Script (4 minutes)

### 0:00 - 0:30 — Hook & Problem Statement
"As autonomous AI agents increasingly execute financial transactions, there's no standardized way to assess their trustworthiness. Qova is a decentralized credit bureau for AI agents, powered by Chainlink CRE."

Show: Dashboard overview page with score distribution, agent count.

### 0:30 - 1:15 — CRE Workflow #1: Reputation Oracle (CRE & AI track)
"Every 10 minutes, our CRE workflow reads agent data from three on-chain contracts, calls an AI API for behavioral analysis, and writes consensus-verified reputation scores back on-chain."

Show:
1. Terminal: `cre workflow simulate reputation-oracle --target staging-settings --broadcast`
2. Logs showing: reading contracts → AI API call → consensus → score computation → on-chain write
3. Dashboard: score update appearing in real-time

### 1:15 - 2:00 — CRE Workflow #2: Transaction Monitor (Risk & Compliance track)
"When an agent executes a suspicious transaction, CRE reacts instantly."

Show:
1. Trigger a transaction on-chain (or simulate the EVM log trigger)
2. CRE workflow detects anomaly → logs show detection logic
3. Anomaly report written on-chain
4. Dashboard: alert appearing on the alerts page

### 2:00 - 2:45 — CRE Workflow #3: World ID Verification (World ID track)
"Agent operators verify their humanity through World ID, orchestrated by CRE."

Show:
1. Dashboard: click "Verify with World ID" button
2. World ID widget opens
3. Proof sent → CRE workflow triggered (show HTTP trigger simulation)
4. DON nodes verify proof via World ID API → consensus
5. Verification written on-chain
6. Dashboard: verified badge appears

### 2:45 - 3:15 — CRE Workflow #4: Budget Enforcement
"Budget alerts and enforcement are automated and tamper-proof."

Show:
1. Budget approaching threshold in dashboard
2. CRE workflow detects 90% utilization
3. Alert fired, enforcement action logged

### 3:15 - 3:45 — Architecture & Composability
"Any protocol can query Qova scores before trusting an agent with funds."

Show:
1. Quick architecture diagram
2. Score read from contract (SDK example)
3. Highlight: 4 CRE workflows, 3 trigger types, AI integration, World ID, all on Base Sepolia

### 3:45 - 4:00 — Close
"Qova — financial trust infrastructure for the agentic economy. Built by Hausor Labs."

Show: qova.cc, GitHub repo link, team.

---

## 3. Production Tips

- Record terminal in high resolution (font size ≥16)
- Use split screen: terminal on left, dashboard on right
- Highlight CRE-specific logs with colored annotations
- Pre-fund wallets so transactions don't fail during recording
- Do a dry run end-to-end before recording
- If CRE UI (cre.chain.link) shows workflow executions, include it — more impressive than just CLI
- Keep narration concise — judges watch many videos

---

## 4. Track Coverage Map

| Timestamp | What's Shown | Track Hit |
|---|---|---|
| 0:30-1:15 | AI API in CRE + reputation scoring | CRE & AI |
| 1:15-2:00 | Anomaly detection + on-chain safeguard | Risk & Compliance |
| 2:00-2:45 | World ID via CRE to Base | World ID with CRE |
| Full video | 4 CRE workflows, all working | Top 10 |
