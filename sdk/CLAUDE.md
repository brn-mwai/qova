# SDK (@qova/core) -- Development Protocol

> Source of truth: `.claude/agents/06-sdk-api.md`

## Stack
TypeScript 5.7, viem 2.47, Zod 3.24, ESM only, target ES2022

## ABI Alignment
- Each ABI file in `src/abi/` MUST match the deployed contract exactly
- ABI types MUST match what CRE workflows use for `encodeFunctionData`/`decodeFunctionResult`
- New contract functions (CRE consumer, verification consumer) must be added to ABIs

## Type Safety Rules
- No `any` types in public API surface
- Use viem `Address`, `Hex`, `Hash` types (not bare strings)
- `BigInt` for all wei/score values (never `Number` for financial data)
- All Zod schemas must validate actual contract return types
- `Result<T, E>` pattern for error handling (not try/catch for expected errors)

## Test Expectations
- 99 tests, 194 assertions (maintain or exceed)
- Tests cover happy paths AND error cases
- Contract interaction tests use proper mocking
- Score computation tests verify BigInt math
- Event watching tests verify filter correctness

## SDK-Contract-CRE Alignment
- SDK reads same contract functions that CRE workflows read
- SDK score computation matches CRE workflow scoring algorithm exactly
- SDK event types match contract event signatures
- Dashboard can use SDK to read verification status written by CRE

## Build & Test
```bash
cd sdk
bun run build    # Compiles to dist/ (ES2022)
bun test         # 99 tests, 194 assertions
```
