Execute the complete build and verification pipeline for hackathon submission.

Run in order:
1. `cd contracts && forge build && forge test` — Smart contracts compile and pass
2. `cd sdk && bun install && bun test` — SDK tests pass (99 tests, 194 assertions)
3. `cd api && bun install && bun run build` — API builds
4. `cd cre && bun install` — CRE dependencies installed
5. `cre workflow simulate reputation-oracle --target staging-settings` — CRE simulates
6. `cre workflow simulate transaction-monitor --target staging-settings` — CRE simulates
7. `cre workflow simulate budget-alert --target staging-settings` — CRE simulates
8. `cre workflow simulate agent-verify --target staging-settings --http-payload '{"agent_address":"0x0000000000000000000000000000000000000001","nullifier_hash":"0x01","merkle_root":"0x01","proof":"0x01","verification_level":"orb"}'` — CRE simulates
9. `cd dashboard && bun install && bun run build` — Dashboard builds
10. `bun run lint` — Biome passes at root

Report status of each step. Fix any failures before proceeding to next step.
