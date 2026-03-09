# n8n-nodes-qova

n8n community nodes for the [Qova](https://qova.cc) AI Agent Credit Bureau API.

Qova is the financial credit bureau for AI agents. It computes economic trustworthiness from on-chain transaction data and enables credit, insurance, and risk assessment for autonomous agents.

## Installation

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install a community node**
3. Enter `n8n-nodes-qova`
4. Agree to the risks and click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-qova
```

Restart n8n after installation.

## Nodes

### Qova

The main node for interacting with the Qova API. Supports four resource types:

| Resource | Operations |
|---|---|
| **Agent** | Get Details, Get Score, Check Registration, Register, Update Score |
| **Score** | Get Breakdown (5 factors), Compute (from raw metrics) |
| **Transaction** | Record |
| **Budget** | Get Status, Set Limits, Check |

### Qova Trigger

A polling trigger that monitors an agent's reputation score and fires when conditions are met:

- **Any Change** - triggers on any score movement
- **Threshold Change** - triggers when score changes by more than N points
- **Grade Change** - triggers when the letter grade changes (e.g. B to C)
- **Score Below** - triggers when the score drops below a value
- **Score Above** - triggers when the score rises above a value

Optionally includes the full 5-factor score breakdown in the trigger output.

## Credentials

Create a **Qova API** credential with:

| Field | Description |
|---|---|
| **API Key** | Your Qova API key from [app.qova.cc](https://app.qova.cc) |
| **Base URL** | API endpoint (default: `https://api.qova.cc`) |

The credential is tested against the `/api/health` endpoint on save.

## Example Workflows

### Trust Gate: Verify Agent Before Payment

1. **Qova Trigger** (Score Below 400)
2. **IF** node: check `currentGrade` is "D" or "F"
3. **Slack** node: alert the ops channel
4. **Qova** node (Budget > Set Limits): reduce daily budget to 0

### Score Monitoring Dashboard

1. **Cron** node: every 15 minutes
2. **Qova** node (Score > Get Breakdown): fetch score for monitored agents
3. **Google Sheets** node: append score + timestamp
4. **IF** node: check if score dropped > 100 points
5. **Email** node: send alert to compliance team

### Post-Transaction Scoring

1. **Webhook** node: receive transaction event
2. **Qova** node (Transaction > Record): log the transaction
3. **Qova** node (Score > Compute): recalculate score with new metrics
4. **Qova** node (Agent > Update Score): write new score on-chain

## API Reference

This node wraps the Qova REST API at `https://api.qova.cc`. Full API documentation is available at [docs.qova.cc](https://docs.qova.cc).

### Endpoints Used

| Node Operation | Method | Endpoint |
|---|---|---|
| Agent: Get Details | GET | `/api/agents/:address` |
| Agent: Get Score | GET | `/api/agents/:address/score` |
| Agent: Check Registration | GET | `/api/agents/:address/registered` |
| Agent: Register | POST | `/api/agents/register` |
| Agent: Update Score | POST | `/api/agents/:address/score` |
| Score: Get Breakdown | GET | `/api/scores/:address` |
| Score: Compute | POST | `/api/scores/compute` |
| Transaction: Record | POST | `/api/transactions/record` |
| Budget: Get Status | GET | `/api/budgets/:address` |
| Budget: Set Limits | POST | `/api/budgets/:address/set` |
| Budget: Check | POST | `/api/budgets/:address/check` |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

### Project Structure

```
integrations/n8n/
  src/
    credentials/
      QovaApi.credentials.ts    # API key + base URL credential
    nodes/
      Qova/
        GenericFunctions.ts      # Shared HTTP helper + address validation
        Qova.node.ts             # Main node (Agent, Score, Transaction, Budget)
        Qova.node.json           # Codex metadata for n8n node discovery
        QovaTrigger.node.ts      # Polling trigger for score changes
        qova.svg                 # Node icon
  tests/
    Qova.node.test.ts            # Unit tests
  package.json
  tsconfig.json
```

## License

MIT

## Links

- [Qova](https://qova.cc) - Financial trust infrastructure for AI agents
- [Qova Docs](https://docs.qova.cc) - API documentation
- [Qova Dashboard](https://app.qova.cc) - Manage agents and API keys
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/) - How to install community nodes
