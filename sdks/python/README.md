# Qova Python SDK

Python SDK for the [Qova Protocol](https://qova.cc) — financial trust infrastructure for AI agents on Base L2.

## Installation

```bash
pip install qova
```

## Quick Start

```python
from qova import Qova

client = Qova("qova_your_api_key")

# Get an agent's trust score
result = client.agents.score("0x...")
print(f"Score: {result['score']}, Grade: {result['grade']}")

# Register a new agent (with idempotency)
tx = client.agents.register("0x...", idempotency_key="unique-uuid")

# Auto-paginate through all agents
for agent in client.agents.list_all():
    print(agent)

# Filter agents
page = client.agents.list(registered=True, min_score=700, limit=10)
for agent in page.data:
    print(agent)
```

## Context Manager

```python
with Qova("qova_your_api_key") as client:
    health = client.health()
    print(health["status"])
```

## Interceptors

```python
from qova import Qova, QovaOptions

client = Qova("qova_your_api_key", QovaOptions(
    on_request=lambda req: print(f"→ {req['method']} {req['url']}"),
    on_response=lambda res: print(f"← {res['status']} ({res['duration_ms']:.0f}ms)"),
))
```

## Error Handling

```python
from qova import Qova, QovaAuthError, QovaRateLimitError, QovaApiError

client = Qova("qova_your_api_key")

try:
    client.agents.score("0xinvalid")
except QovaAuthError as e:
    print(f"Auth failed: {e}")
except QovaRateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except QovaApiError as e:
    print(f"API error {e.status}: {e.code} — {e}")
```

## Webhooks

```python
# Create a webhook
hook = client.webhooks.create(
    url="https://your-app.com/webhook",
    events=["agent.registered", "agent.score.updated"],
)
print(f"Webhook secret: {hook['secret']}")

# Send a test ping
client.webhooks.test(hook["id"])

# View delivery logs
deliveries = client.webhooks.deliveries(hook["id"])
```

## Resources

| Resource | Methods |
|----------|---------|
| `client.agents` | `list`, `list_all`, `get`, `score`, `is_registered`, `register`, `update_score`, `batch_update_scores` |
| `client.scores` | `breakdown`, `compute`, `enrich`, `anomaly_check` |
| `client.transactions` | `stats`, `record` |
| `client.budgets` | `get`, `set`, `check`, `record_spend` |
| `client.keys` | `create`, `list`, `revoke` |
| `client.webhooks` | `create`, `list`, `get`, `update`, `delete`, `deliveries`, `test`, `rotate_secret` |
