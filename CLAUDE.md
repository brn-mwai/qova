# Qova -- Financial Trust Infrastructure for AI Agents

## What This Is
Qova (qova.cc) is the financial credit bureau for AI agents. It computes economic
trustworthiness from transaction data and enables credit, insurance, and risk
assessment for autonomous agents operating via the x402 payment protocol.

## Architecture
Monorepo with 6 packages: contracts (Solidity/Foundry), sdk (TypeScript),
api (Hono on Bun), dashboard (Next.js 15), cre (Chainlink CRE/TypeScript),
integrations (framework plugins).

Deployed on: Base L2 (contracts), Vercel (dashboard), Convex (real-time DB),
Chainlink CRE Network (workflows).

## Tech Stack
- Runtime: Bun (not Node). Use `bun` for all package management and execution.
- Smart Contracts: Solidity 0.8.28+, Foundry (forge, cast, anvil). NOT Hardhat.
- SDK: TypeScript 5.7+, strict mode, ESM only. Target: ES2022.
- API: Hono framework on Bun. NOT Express. NOT Fastify.
- Dashboard: Next.js 15, App Router, React 19, Tailwind v4, shadcn/ui.
- Database: Convex (real-time). NOT PostgreSQL. NOT Drizzle.
- Auth: Clerk with SIWE (Sign In With Ethereum). NOT custom JWT.
- Icons: Phosphor Icons (@phosphor-icons/react). NEVER Lucide.
- Charts: shadcn Chart + Recharts.
- CRE: @chainlink/cre-sdk (TypeScript), Bun runtime for WASM compilation.
- Testing: Vitest (TS packages), Forge test (contracts).
- Linting: Biome (not ESLint). Run `bun run check` to lint+format.
- Blockchain: viem + wagmi (NOT ethers.js).
- Validation: Zod everywhere.
- Monorepo: Turborepo.

## UI Design System
- Colors: Black (#000000) / White (#FFFFFF) base. Yellow (#FACC15) for active/warning/CTA. Red (#EF4444) for errors/critical. Green (#22C55E) for success only.
- No decorative color. Every color has functional meaning.
- Fonts: Inter (UI text), JetBrains Mono (scores, numbers, code, addresses).
- Icons: Phosphor Icons -- regular weight default, fill for active, duotone for decorative.
- Dark mode FIRST. Light mode secondary.
- Logo: Monochrome only. Accent colors never touch the logo.

## Code Style
- All functions must have explicit TypeScript return types.
- Use Result<T, E> pattern for error handling, not try/catch for expected errors.
- No `any` type. Use `unknown` and narrow.
- Prefer const assertions and discriminated unions over enums.
- Use Zod for all runtime validation.
- All smart contract functions must have NatSpec documentation.
- Prefer composition over inheritance in contracts.

## Build & Test Commands
- `bun install` -- install all dependencies
- `bun run build` -- build all packages (turborepo)
- `bun run test` -- run all tests
- `cd contracts && forge build` -- compile contracts
- `cd contracts && forge test` -- run contract tests
- `bun run check` -- lint and format all TypeScript

## Git Conventions
- Conventional commits: feat(sdk):, fix(contracts):, docs:, test:, chore:
- Always commit working code. Never commit broken builds.
- Update qova-progress.txt after completing each task.
- Author: "Qova Engineering <eng@qova.cc>" (never "Claude")

## Security Rules (NON-NEGOTIABLE)
- NEVER hardcode private keys, API keys, or secrets. Use env vars.
- ALL user inputs validated with Zod before processing.
- ALL smart contract functions that move funds must have reentrancy guards.
- ALL external calls in contracts follow checks-effects-interactions.
- Rate limiting on all API endpoints.
- No eval(), no dynamic code execution, no innerHTML in dashboard.

## What Gets Wrong (READ THIS)
- Do NOT use ethers.js. Use viem.
- Do NOT use npm or yarn. Use bun.
- Do NOT use Express. The API uses Hono.
- Do NOT use Lucide icons. Use @phosphor-icons/react.
- Do NOT use PostgreSQL/Drizzle. Use Convex.
- Do NOT create .js files. Everything is .ts with ESM.
- Do NOT skip tests. Every new function needs a test.
- Do NOT use console.log in production code. Use the structured logger.
- Do NOT leave "Claude" or "AI assistant" references in production code.

---

## HACKATHON EXPERT AGENTS

This project has 11 specialized expert agents in `.claude/agents/`. Before working on ANY part of the codebase, read the relevant agent file first.

### Agent Routing
| Working on... | Read first |
|---|---|
| `cre/` (any CRE workflow) | `.claude/agents/01-cre-workflow.md` |
| World ID integration | `.claude/agents/02-world-id-cre.md` |
| Anomaly detection, budget alerts | `.claude/agents/03-risk-compliance.md` |
| AI/LLM integration in CRE | `.claude/agents/04-ai-integration.md` |
| `contracts/` (Solidity) | `.claude/agents/05-smart-contracts.md` |
| `sdk/` or `api/` | `.claude/agents/06-sdk-api.md` |
| README, docs | `.claude/agents/07-docs-readme.md` |
| Video demo planning | `.claude/agents/08-demo-video.md` |
| SKALE, x402, zero gas | `.claude/agents/09-skale-integration.md` |
| Security review | `.claude/agents/10-cybersecurity.md` |
| `dashboard/` (UI/UX) | `.claude/agents/11-dashboard-ui.md` |

### Execution Priority (Hackathon)
1. CRE Workflows → 2. Smart Contracts → 3. World ID × CRE → 4. AI Integration → 5. Risk & Compliance → 6. SKALE → 7. Dashboard → 8. SDK/API → 9. Security → 10. Docs/README

### Universal Rules
- `.result()` pattern for all CRE SDK calls (never async/await)
- `runtime.log()` only (never console.log in CRE workflows)
- `runtime.now()` only (never Date.now() in CRE workflows)
- BigInt for ALL financial math (never floats)
- HTTPClient ONLY inside `runInNodeMode()` with consensus aggregation
- `hexToBase64()` on all EVM log trigger addresses/topics
- Explicit `gasLimit` on all `writeReport()` calls
- Zod config schemas on all workflows
- ReceiverTemplate on all CRE consumer contracts
- No hardcoded secrets anywhere

### Detailed instructions in `claude-2.md`
For the complete phase-by-phase build instructions, file structures, code templates, service quotas, and hackathon checklist, read `claude-2.md` in the repo root.
