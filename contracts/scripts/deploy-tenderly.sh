#!/usr/bin/env bash
# Deploy Qova contracts to a Tenderly Virtual TestNet
# Usage: bash scripts/deploy-tenderly.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$CONTRACTS_DIR")"
DEPLOYMENTS_DIR="$CONTRACTS_DIR/deployments"
FORGE="${HOME}/.foundry/bin/forge"

# Load env vars from contracts/.env
if [ -f "$CONTRACTS_DIR/.env" ]; then
    set -a
    source "$CONTRACTS_DIR/.env"
    set +a
fi

# Also load from root .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

# Validate required vars
if [ -z "${TENDERLY_VIRTUAL_TESTNET_RPC:-}" ]; then
    echo "Error: TENDERLY_VIRTUAL_TESTNET_RPC not set"
    echo ""
    echo "Setup steps:"
    echo "  1. Go to https://dashboard.tenderly.co"
    echo "  2. Create a Virtual TestNet (fork Base Sepolia, chain 84532)"
    echo "  3. Copy the RPC URL"
    echo "  4. Set TENDERLY_VIRTUAL_TESTNET_RPC in contracts/.env"
    exit 1
fi

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
    echo "Error: DEPLOYER_PRIVATE_KEY not set in contracts/.env"
    exit 1
fi

echo "================================================"
echo "  Qova -> Tenderly Virtual TestNet Deployment"
echo "================================================"
echo ""
echo "RPC: ${TENDERLY_VIRTUAL_TESTNET_RPC:0:60}..."
echo ""

# Deploy
cd "$CONTRACTS_DIR"
OUTPUT=$("$FORGE" script script/DeployTenderly.s.sol \
    --rpc-url "$TENDERLY_VIRTUAL_TESTNET_RPC" \
    --private-key "$DEPLOYER_PRIVATE_KEY" \
    --broadcast \
    -vvv 2>&1)

echo "$OUTPUT"

# Extract addresses from forge output
REGISTRY=$(echo "$OUTPUT" | grep "ReputationRegistry:" | head -1 | awk '{print $NF}')
VALIDATOR=$(echo "$OUTPUT" | grep "TransactionValidator:" | head -1 | awk '{print $NF}')
ENFORCER=$(echo "$OUTPUT" | grep "BudgetEnforcer:" | head -1 | awk '{print $NF}')
CORE=$(echo "$OUTPUT" | grep "QovaCore:" | head -1 | awk '{print $NF}')
DEPLOYER=$(echo "$OUTPUT" | grep "Deployer:" | head -1 | awk '{print $NF}')
CHAIN_ID=$(echo "$OUTPUT" | grep "Chain ID:" | head -1 | awk '{print $NF}')

if [ -z "$REGISTRY" ] || [ -z "$CORE" ]; then
    echo ""
    echo "Warning: Could not parse addresses from output."
    echo "Check the forge output above for deployed addresses."
    exit 0
fi

# Save deployment record
mkdir -p "$DEPLOYMENTS_DIR"
cat > "$DEPLOYMENTS_DIR/tenderly-virtual.json" << EOF
{
  "network": "tenderly-virtual-testnet",
  "chainId": ${CHAIN_ID:-84532},
  "rpcUrl": "$TENDERLY_VIRTUAL_TESTNET_RPC",
  "deployer": "$DEPLOYER",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "solidityVersion": "0.8.28",
  "evmVersion": "cancun",
  "optimizerRuns": 200,
  "contracts": {
    "ReputationRegistry": { "address": "$REGISTRY" },
    "TransactionValidator": { "address": "$VALIDATOR" },
    "BudgetEnforcer": { "address": "$ENFORCER" },
    "QovaCore": { "address": "$CORE" }
  },
  "demoAgents": {
    "agent1_BBB": "0x0000000000000000000000000000000000000001",
    "agent2_AA": "0x0000000000000000000000000000000000000002",
    "agent3_CCC": "0x0000000000000000000000000000000000000003"
  }
}
EOF

echo ""
echo "================================================"
echo "  Deployment saved: deployments/tenderly-virtual.json"
echo "================================================"
echo ""
echo "Contract Addresses (for CRE config):"
echo "  TENDERLY_REPUTATION_REGISTRY=$REGISTRY"
echo "  TENDERLY_TRANSACTION_VALIDATOR=$VALIDATOR"
echo "  TENDERLY_BUDGET_ENFORCER=$ENFORCER"
echo "  TENDERLY_QOVA_CORE=$CORE"
echo ""
echo "To run CRE workflows against Tenderly:"
echo "  export TENDERLY_VIRTUAL_TESTNET_RPC=$TENDERLY_VIRTUAL_TESTNET_RPC"
echo "  export TENDERLY_REPUTATION_REGISTRY=$REGISTRY"
echo "  export TENDERLY_TRANSACTION_VALIDATOR=$VALIDATOR"
echo "  export TENDERLY_BUDGET_ENFORCER=$ENFORCER"
echo "  cd cre && cre workflow simulate reputation-oracle --target tenderly-reputation-oracle"
echo ""
echo "Tenderly Explorer:"
echo "  Check your Virtual TestNet dashboard for transaction history and contract state"
