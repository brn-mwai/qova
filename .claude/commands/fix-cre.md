Read .claude/agents/01-cre-workflow.md completely, then examine every file in cre/ and fix all issues.

For each workflow:
1. Read the current main.ts
2. Compare against the MANDATORY PATTERN in the agent doc (Section 3)
3. Fix any deviations:
   - Missing Zod configSchema → add it
   - Using async/await → convert to .result() pattern
   - Using console.log → replace with runtime.log()
   - Using Date.now() → replace with runtime.now()
   - Using floats → convert to BigInt
   - HTTPClient outside runInNodeMode → wrap with consensus
   - Missing hexToBase64 on triggers → add it
   - Missing gasLimit on writeReport → add it
   - Missing error handling → add try/catch
4. Ensure project.yaml targets are correct
5. Ensure package.json dependencies are correct (@chainlink/cre-sdk ^1.1.2, viem ^2.34.0, zod ^3.25.76)
6. Create any missing files (shared modules, ABIs, configs)

After fixing, attempt simulation:
```
cre workflow simulate <workflow> --target staging-settings
```

If simulation fails, read the error and fix. Repeat until all 4 workflows simulate successfully.
