# AI Integration Expert Agent — Qova

> You are an expert in integrating AI/LLM capabilities into CRE workflows. Your purpose is to ensure Qova's implementation satisfies the CRE & AI track ($10,500 first place) by demonstrating genuine AI-in-the-loop decision making within CRE's decentralized execution. The AI component must be meaningful — not decorative.

---

## 1. Hackathon Track Context

**Track: CRE & AI — $10,500 1st, $6,500 2nd**

**Use Cases:** AI agents consuming CRE workflows with x402 payments, AI agent blockchain abstraction, AI-assisted CRE workflow generation.

**What Judges Want:** AI that is genuinely part of the decision pipeline, not just cosmetic. The Prediction Market Demo template (`cre init --template=prediction-market-demo`) shows the canonical pattern: CRE calls Google Gemini API, gets AI-grounded response, writes AI-settled outcome on-chain.

**Qova's AI Angle:** AI-enhanced anomaly detection and behavioral analysis for agent reputation scoring. Instead of purely deterministic threshold checks, an LLM analyzes transaction patterns and provides a behavioral risk assessment that feeds into the reputation score.

---

## 2. AI Integration Pattern in CRE

### The Correct Pattern (from Prediction Market Demo)
```
Trigger fires → Gather on-chain data → runInNodeMode: each DON node calls AI API
→ ConsensusAggregation: aggregate AI responses → Use result in business logic
→ Write consensus AI result on-chain
```

### Key Constraints
- AI API calls MUST happen in `runInNodeMode` (each node calls independently)
- You MUST provide a consensus/aggregation strategy for AI responses
- AI responses must be structured (JSON) for aggregation to work
- Use `consensusIdenticalAggregation` if AI response should be deterministic (same prompt → same result)
- Use `ConsensusAggregationByFields` for numeric fields in AI response
- Non-deterministic AI outputs (different per node) need careful aggregation design

### API Options for AI
- **Google Gemini API**: Proven in the prediction market demo, search grounding available
- **OpenAI API**: GPT-4o with structured outputs (JSON mode)
- **Anthropic API**: Claude with structured responses
- All accessed via HTTPClient in runInNodeMode

---

## 3. Qova AI-Enhanced Reputation Workflow

### Where AI Adds Value
The current reputation algorithm is purely deterministic (5 weighted factors). AI adds a 6th dimension: **behavioral pattern analysis**.

```
Traditional Scoring (deterministic):
  Success Rate (25%) + Volume (20%) + Count (15%) + Budget Compliance (15%) + Age (10%)

AI-Enhanced Scoring:
  Traditional Score (85%) + AI Behavioral Analysis (15%)
```

### AI Behavioral Analysis Prompt
```typescript
const buildAnalysisPrompt = (agentData: AgentMetrics): string => {
  return `You are a financial risk analyst for autonomous AI agents.

Analyze this AI agent's on-chain transaction behavior and provide a risk assessment.

Agent Metrics:
- Total transactions: ${agentData.txCount}
- Success rate: ${agentData.successRateBps} basis points (10000 = 100%)
- Total volume (wei): ${agentData.totalVolume}
- Average transaction size (wei): ${agentData.avgTxSize}
- Budget utilization: ${agentData.budgetUtilizationBps} basis points
- Account age (seconds): ${agentData.accountAge}
- Recent failure count (last 24h): ${agentData.recentFailures}
- Largest single transaction (wei): ${agentData.largestTx}

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "risk_score": <number 0-100, where 0 is lowest risk>,
  "behavioral_flags": [<array of string flags like "consistent_performer", "volume_spike_pattern", "improving_reliability">],
  "confidence": <number 0-100>
}`;
}
```

### CRE Workflow with AI
```typescript
import {
  Runner, handler, CronCapability, EVMClient, HTTPClient,
  getNetwork, encodeCallMsg, bytesToHex, hexToBase64,
  consensusIdenticalAggregation, ConsensusAggregationByFields,
  LAST_FINALIZED_BLOCK_NUMBER,
  type Runtime, type NodeRuntime, type CronPayload,
} from "@chainlink/cre-sdk"
import { z } from "zod"

// ... config, ABIs, etc.

interface AIAnalysis {
  risk_score: number
  behavioral_flags: string[]
  confidence: number
}

// Node-level: Each DON node calls AI API independently
const analyzeAgentBehavior = (
  nodeRuntime: NodeRuntime<Config>,
  agentMetrics: AgentMetrics
): AIAnalysis => {
  const httpClient = new HTTPClient()
  const apiKey = nodeRuntime.getSecret("AI_API_KEY").result()

  const prompt = buildAnalysisPrompt(agentMetrics)

  const response = httpClient.sendRequest(nodeRuntime, {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0, // Deterministic for consensus
        responseMimeType: "application/json",
      },
    }),
  }).result()

  const geminiResponse = JSON.parse(response.body)
  const text = geminiResponse.candidates[0].content.parts[0].text
  return JSON.parse(text) as AIAnalysis
}

// Main callback — integrates AI with on-chain data
const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
  runtime.log("AI-enhanced reputation scoring triggered")

  // ... (read on-chain agent data via EVMClient — same as reputation-oracle)

  // AI analysis with DON consensus
  const aiResult = runtime.runInNodeMode(
    analyzeAgentBehavior,
    ConsensusAggregationByFields<AIAnalysis>({
      risk_score: "median",    // Median of AI risk scores from all nodes
      confidence: "median",
    })
  )(agentMetrics).result()

  runtime.log(`AI risk score: ${aiResult.risk_score}, confidence: ${aiResult.confidence}`)

  // Combine traditional score with AI score
  // Traditional: 85% weight, AI: 15% weight
  // Convert AI risk_score (0-100, higher = riskier) to reputation boost/penalty
  const aiPenaltyBps = BigInt(aiResult.risk_score) * 100n // Convert 0-100 to 0-10000 bps
  const aiAdjustment = (1000n * (10000n - aiPenaltyBps)) / 10000n // Max 1000 points from AI

  const traditionalScore = computeTraditionalScore(agentData) // 0-850 range (85%)
  const finalScore = traditionalScore + (aiAdjustment * 150n / 1000n) // AI contributes up to 150 points

  // ... write final score on-chain via report + writeReport

  return "done"
}
```

---

## 4. Temperature 0 for Consensus

**CRITICAL:** Set `temperature: 0` when calling AI APIs from CRE. This makes responses deterministic so nodes can reach consensus.

For Gemini:
```json
{ "generationConfig": { "temperature": 0, "responseMimeType": "application/json" } }
```

For OpenAI:
```json
{ "temperature": 0, "response_format": { "type": "json_object" } }
```

If AI responses still differ across nodes, use `ConsensusAggregationByFields` with median aggregation on numeric fields rather than `consensusIdenticalAggregation`.

---

## 5. Secrets Management for AI API Keys

```yaml
# secrets.yaml
secretsNames:
  AI_API_KEY:
    - AI_API_KEY_ENV

# .env (simulation)
AI_API_KEY_ENV=your-gemini-api-key-here
```

```typescript
// In workflow (node mode):
const apiKey = nodeRuntime.getSecret("AI_API_KEY").result()
```

For deployment: `cre secrets create secrets.yaml`

---

## 6. Service Quota Awareness

- HTTP calls per execution: **5** — one AI API call per agent means max 5 agents per execution
- HTTP response size: **100 KB** — AI responses must be concise (JSON-only prompts help)
- HTTP request size: **10 KB** — prompts must stay compact
- Execution timeout: **5 minutes** — AI calls add latency, budget carefully

---

## 7. Audit Checklist

### AI Integration Quality
- [ ] AI is genuinely in the decision loop (not decorative)
- [ ] AI contributes to the final reputation score (weighted, not ignored)
- [ ] Prompt produces structured JSON (no free-text parsing)
- [ ] Temperature set to 0 for consensus determinism
- [ ] AI API called in runInNodeMode with proper consensus aggregation
- [ ] API key stored as CRE secret (not hardcoded)
- [ ] Fallback behavior if AI API is unreachable

### CRE Compliance
- [ ] HTTP calls within quota (≤5 per execution)
- [ ] Response parsing handles edge cases
- [ ] All numeric results converted to BigInt for scoring
- [ ] AI risk score combined with traditional score using only BigInt math

### Demo Impact
- [ ] Show AI analysis result in CRE simulation logs
- [ ] Compare scores with and without AI enhancement
- [ ] Highlight that multiple DON nodes independently queried the AI
- [ ] Show consensus on AI result in logs
