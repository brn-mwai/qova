Audit all CRE workflows in the cre/ directory against the CRE Workflow Expert Agent specifications in .claude/agents/01-cre-workflow.md.

For each workflow (reputation-oracle, transaction-monitor, budget-alert, agent-verify):
1. Check if main.ts exists and follows the mandatory workflow structure (main → Runner → initWorkflow → handler)
2. Verify Zod config schema is present
3. Check all SDK calls use .result() pattern (not async/await)
4. Verify runtime.log() is used (not console.log)
5. Verify runtime.now() is used (not Date.now())
6. Check HTTPClient is ONLY inside runInNodeMode with consensus
7. Verify all BigInt math (no floats)
8. Check EVM log triggers use hexToBase64 and padHex
9. Verify writeReport has explicit gasLimit
10. Check project.yaml and secrets.yaml exist and are correct

Report ALL issues found with file paths and line numbers. Then fix each issue.
