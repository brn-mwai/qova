Run a full security review of the entire Qova codebase using .claude/agents/10-cybersecurity.md.

IMMEDIATE CHECKS:
1. Search for hardcoded secrets: grep -r "private.key\|api_key\|secret\|password" --include="*.ts" --include="*.sol" --include="*.yaml" --include="*.json" . (excluding node_modules, .git)
2. Verify .env is in .gitignore
3. Check public Convex mutations (syncFromChain, createServerExecution, upsertUser, deleteUser, linkWallet) have proper input validation
4. Check webhook URL validation rejects internal IPs (10.x, 172.16.x, 192.168.x, localhost, 127.0.0.1)
5. Check API key comparison uses timing-safe equality
6. Check CORS is restricted to app.qova.cc domain
7. Verify no console.log leaks sensitive data in production
8. Check smart contract access control (only Forwarder can call onReport)
9. Verify replay protection in all CRE consumer contracts

Report severity for each issue: CRITICAL / HIGH / MEDIUM / LOW
Fix all CRITICAL and HIGH issues immediately.
