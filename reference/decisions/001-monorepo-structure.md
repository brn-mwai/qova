# ADR-001: Monorepo Structure

**Date:** 2026-02-26
**Status:** Accepted
**Author:** Qova Engineering

## Context
Qova consists of multiple tightly coupled packages (smart contracts, SDK, API, dashboard, CRE workflows, integrations). We needed to decide between a monorepo and multi-repo approach.

## Decision
Use a Bun workspaces monorepo managed by Turborepo.

Packages:
- `contracts` -- Solidity/Foundry smart contracts
- `sdk` -- TypeScript SDK (@brnmwai/qova-core)
- `api` -- Hono REST API
- `dashboard` -- Next.js 15 frontend
- `cre` -- Chainlink CRE workflows
- `integrations/*` -- Framework-specific plugins

## Alternatives Considered
1. **Multi-repo**: Better isolation but harder to coordinate cross-package changes and versioning.
2. **Nx**: More features than Turborepo but heavier setup. Turborepo's simplicity wins for our team size.

## Consequences
- **Gained**: Atomic cross-package changes, shared tooling config, simplified CI.
- **Sacrificed**: Independent deployment pipelines per package (mitigated by Turborepo's selective builds).
