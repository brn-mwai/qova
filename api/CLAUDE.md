# API -- Development Protocol

> Sources of truth: `.claude/agents/06-sdk-api.md`, `.claude/agents/10-cybersecurity.md`

## Stack
Hono 4.7, Bun runtime, Zod validation, Vercel serverless deployment

## Endpoints (21 total)
- health (1), agents (7), transactions (2), budgets (4), scores (5), verify (2)

## Endpoint Validation
- ALL request bodies validated with Zod schemas before processing
- ALL responses follow consistent structure: `{ success, data?, error? }`
- Proper HTTP status codes: 200 (ok), 201 (created), 400 (bad input), 404 (not found), 429 (rate limited), 500 (server error)

## Rate Limiting
- 100 requests per minute per IP (in-memory tracker)
- Consider per-API-key limiting for production

## Caching
- 30-second TTL in-memory cache on GET endpoints
- Cache-Control headers set appropriately

## CORS
- Restrict to dashboard domain (app.qova.cc) in production
- Allow localhost:3000 in development

## Security Requirements
- [ ] API key comparison uses timing-safe equality (`crypto.timingSafeEqual`)
- [ ] No error details (stack traces, internal paths) in production responses
- [ ] Helmet-equivalent headers: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
- [ ] Input sanitization beyond Zod: reject oversized payloads, strip unexpected fields
- [ ] No hardcoded secrets (use env vars)
- [ ] Webhook SSRF prevention: reject internal IPs in webhook URLs

## Build & Test
```bash
cd api
bun run dev      # Dev server on port 3001
bun test         # 44 tests across 10 files
```
