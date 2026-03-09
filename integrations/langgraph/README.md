# qova-langchain

LangChain and LangGraph tools for [Qova](https://qova.cc) - the financial credit bureau for AI agents.

## Installation

```bash
pip install qova-langchain
```

With LangGraph support:

```bash
pip install qova-langchain[langgraph]
```

## Quick Start

### Environment Variables

```bash
export QOVA_API_URL="https://api.qova.cc"   # default
export QOVA_API_KEY="your-api-key"
```

### Using the Toolkit (LangChain)

```python
from langchain_openai import ChatOpenAI
from qova_langchain import QovaToolkit

# Get all 6 Qova tools
toolkit = QovaToolkit()
tools = toolkit.get_tools()

# Bind to an LLM
llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools)

response = llm_with_tools.invoke(
    "What is the reputation score for agent 0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158?"
)
```

### Using with LangGraph

```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from qova_langchain import QovaToolkit

llm = ChatOpenAI(model="gpt-4o")
toolkit = QovaToolkit()

# Create a ReAct agent with Qova tools
agent = create_react_agent(llm, toolkit.get_tools())

result = agent.invoke({
    "messages": [
        ("user", "Check the reputation of 0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158 "
                 "and tell me if it's trustworthy for a 1 ETH transaction")
    ]
})

for message in result["messages"]:
    print(message.content)
```

### Using Individual Tools

```python
from qova_langchain import QovaScoreLookupTool, QovaBudgetCheckTool

# Use specific tools instead of the full toolkit
score_tool = QovaScoreLookupTool()
budget_tool = QovaBudgetCheckTool()

# Sync usage
result = score_tool.invoke({"address": "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"})

# Async usage
result = await score_tool.ainvoke({"address": "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"})
```

### Callback Handler (Auto-Report Agent Actions)

The callback handler automatically records every tool call your agent makes as a Qova transaction, building the agent's financial reputation without any code changes to the agent itself.

```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from qova_langchain import QovaCallbackHandler, QovaToolkit

llm = ChatOpenAI(model="gpt-4o")

# Your agent's Qova-registered address
handler = QovaCallbackHandler(
    agent_address="0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
    auto_budget_check=True,  # check budget before each action
)

# Create agent with Qova tools + any other tools
qova_tools = QovaToolkit().get_tools()
agent = create_react_agent(llm, qova_tools + your_other_tools)

# The callback handler auto-records all tool calls to Qova
result = agent.invoke(
    {"messages": [("user", "Swap 100 USDC for ETH on Uniswap")]},
    config={"callbacks": [handler]},
)

# Check metrics
print(handler.get_metrics())
# {"total_recorded": 3, "total_errors": 0, "budget_violations": 0}
```

#### Selective Tracking

```python
# Only track specific tools
handler = QovaCallbackHandler(
    agent_address="0x...",
    track_tools=["swap", "bridge", "transfer"],  # only these
)

# Or exclude internal tools
handler = QovaCallbackHandler(
    agent_address="0x...",
    ignore_tools=["search_web", "calculate"],  # skip these
)
```

### Read-Only Mode

For agents that should only check scores without writing:

```python
toolkit = QovaToolkit(
    include=["qova_score_lookup", "qova_budget_check", "qova_compute_score"]
)
```

## Tools

| Tool | Description | Writes On-Chain |
|------|-------------|:---:|
| `qova_score_lookup` | Look up an agent's reputation score with full factor breakdown | No |
| `qova_register_agent` | Register a new AI agent on the Qova credit bureau | Yes |
| `qova_record_transaction` | Record a financial transaction for reputation scoring | Yes |
| `qova_budget_check` | Check if a spend amount is within the agent's budget | No |
| `qova_budget_set` | Set daily, monthly, and per-transaction budget limits | Yes |
| `qova_compute_score` | Compute a hypothetical score from raw metrics (stateless) | No |

## LangGraph Custom Nodes

For advanced LangGraph workflows, use tools as graph nodes:

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_core.messages import ToolMessage
from qova_langchain import QovaScoreLookupTool, QovaBudgetCheckTool

score_tool = QovaScoreLookupTool()
budget_tool = QovaBudgetCheckTool()

def check_reputation(state: MessagesState):
    """Gate node: check agent reputation before proceeding."""
    result = score_tool.invoke({"address": state["agent_address"]})
    # Parse score and decide whether to proceed
    import json
    data = json.loads(result)
    if data.get("score", 0) < 500:
        return {"messages": [("system", "Agent reputation too low. Aborting.")]}
    return {"messages": [("system", f"Agent score: {data['score']} ({data['grade']}). Proceeding.")]}

def check_budget(state: MessagesState):
    """Gate node: verify budget before executing transaction."""
    result = budget_tool.invoke({
        "agent": state["agent_address"],
        "amount": state["tx_amount"],
    })
    import json
    data = json.loads(result)
    if not data.get("withinBudget", False):
        return {"messages": [("system", "Transaction exceeds budget. Blocked.")]}
    return {"messages": [("system", "Budget check passed. Executing.")]}

graph = StateGraph(MessagesState)
graph.add_node("check_reputation", check_reputation)
graph.add_node("check_budget", check_budget)
graph.add_edge(START, "check_reputation")
graph.add_edge("check_reputation", "check_budget")
graph.add_edge("check_budget", END)

app = graph.compile()
```

## Development

```bash
# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Lint
ruff check src/ tests/

# Type check
mypy src/
```

## License

MIT
