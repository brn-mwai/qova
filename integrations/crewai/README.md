# qova-crewai

CrewAI tools for the [Qova](https://qova.cc) AI agent reputation and credit scoring system.

This package provides five tools that let CrewAI agents interact with the Qova REST API to look up reputation scores, register agents, record transactions, check budgets, and compute scores from raw metrics.

## Installation

```bash
pip install qova-crewai
```

Or install from source:

```bash
cd integrations/crewai
pip install -e ".[dev]"
```

## Quick start

```python
from crewai import Agent, Crew, Task
from qova_crewai import get_qova_tools

# Create all Qova tools with a shared HTTP client
tools = get_qova_tools()

# Create an agent with Qova tools
analyst = Agent(
    role="Financial Trust Analyst",
    goal="Assess the trustworthiness of AI agents before transacting with them",
    backstory="You are an expert at evaluating AI agent reputations using the Qova credit bureau.",
    tools=tools,
)

# Define a task
task = Task(
    description="Look up the reputation score of agent 0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158 and provide a risk assessment.",
    expected_output="A risk assessment with the agent's score, grade, and recommendation.",
    agent=analyst,
)

# Run
crew = Crew(agents=[analyst], tasks=[task])
result = crew.kickoff()
print(result)
```

## Configuration

Set these environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `QOVA_API_URL` | No | `https://api.qova.cc` | Qova API base URL |
| `QOVA_API_KEY` | Yes | - | API key for authenticated endpoints |

Or pass them directly:

```python
tools = get_qova_tools(
    base_url="https://api.qova.cc",
    api_key="your-api-key",
)
```

## Tools

### `QovaScoreLookupTool`

Look up an agent's reputation score (0-1000), letter grade (AAA to D), and optionally a detailed breakdown of contributing factors.

```python
from qova_crewai import QovaScoreLookupTool

tool = QovaScoreLookupTool()

# Basic score
result = tool._run(agent_address="0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158")

# With full breakdown
result = tool._run(
    agent_address="0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
    include_breakdown=True,
)
```

### `QovaRegisterAgentTool`

Register a new AI agent on the Qova blockchain reputation system.

```python
from qova_crewai import QovaRegisterAgentTool

tool = QovaRegisterAgentTool()
result = tool._run(agent_address="0x1234567890abcdef1234567890abcdef12345678")
```

### `QovaRecordTransactionTool`

Record a financial transaction to build an agent's reputation.

```python
from qova_crewai import QovaRecordTransactionTool

tool = QovaRecordTransactionTool()
result = tool._run(
    agent_address="0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
    tx_hash="0xabcdef...",
    amount="1000000",  # in wei
    tx_type=0,          # 0=PAYMENT, 1=SWAP, 2=TRANSFER, 3=CONTRACT_CALL, 4=BRIDGE
)
```

### `QovaBudgetCheckTool`

Check if a proposed spend is within an agent's on-chain budget limits before executing.

```python
from qova_crewai import QovaBudgetCheckTool

tool = QovaBudgetCheckTool()
result = tool._run(
    agent_address="0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
    amount="10000000",  # in wei
)
```

### `QovaComputeScoreTool`

Compute a score from raw metrics without on-chain reads. Useful for simulations.

```python
from qova_crewai import QovaComputeScoreTool

tool = QovaComputeScoreTool()
result = tool._run(
    total_volume="1500000000000000000",
    transaction_count=47,
    success_rate=9574,          # basis points (95.74%)
    daily_spent="35000000",
    daily_limit="100000000",
    account_age_seconds=7257600,  # 84 days
)
```

## Using individual tools

You can also import and use tools individually:

```python
from crewai import Agent
from qova_crewai import QovaScoreLookupTool, QovaBudgetCheckTool, QovaClient

# Share a client across specific tools
client = QovaClient(api_key="your-key")

agent = Agent(
    role="Budget Auditor",
    goal="Verify agents stay within their spending limits",
    tools=[
        QovaScoreLookupTool(qova_client=client),
        QovaBudgetCheckTool(qova_client=client),
    ],
)
```

## Score grades

| Grade | Score Range | Meaning |
|---|---|---|
| AAA | 900 - 1000 | Exceptional trustworthiness |
| AA | 800 - 899 | Very high trustworthiness |
| A | 700 - 799 | High trustworthiness |
| BBB | 600 - 699 | Good trustworthiness |
| BB | 500 - 599 | Moderate trustworthiness |
| B | 400 - 499 | Below average |
| CCC | 300 - 399 | Low trustworthiness |
| CC | 200 - 299 | Very low trustworthiness |
| C | 100 - 199 | Poor trustworthiness |
| D | 0 - 99 | Default / unrated |

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Lint
ruff check src/ tests/

# Format
ruff format src/ tests/
```

## License

MIT
