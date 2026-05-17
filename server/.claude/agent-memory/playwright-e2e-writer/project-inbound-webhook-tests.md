---
name: project-inbound-webhook-tests
description: Patterns and notes from writing inbound.spec.ts — pure API-level Playwright tests using the `request` fixture
metadata:
  type: project
---

## File
`client/e2e/inbound.spec.ts`

## Approach — pure API tests, no browser
- Uses Playwright's `request` fixture directly — no `page`, no navigation
- Requests go to `ENDPOINT = "/api/inbound/email"` — the baseURL (`http://localhost:5174`) + Vite proxy carries them to the test server on port 3001
- No login needed: the inbound webhook is a public endpoint (no `requireAuth`)

## Controller location
`server/src/controllers/inbound.ts` — reads `process.env.WEBHOOK_SECRET` at request time (not startup), so auth is toggled by presence of that env var.

## Webhook secret auth tests
- `WEBHOOK_SECRET` is **not** set in `server/.env.test` by default
- Auth describe block uses `test.skip(!WEBHOOK_SECRET, reason)` — skips cleanly at runtime when the var is absent
- To enable: add `WEBHOOK_SECRET=test-webhook-secret-123` to `server/.env.test` and restart the test runner; the var flows via `loadEnvFile` in `playwright.config.ts` into the webServer env
- The `process.env.WEBHOOK_SECRET` read in the spec file picks up the value from the host environment if also exported there — but the server's env comes from `.env.test` loaded via `playwright.config.ts`, so both sides must agree

## Valid payload shape
```ts
const VALID_PAYLOAD = {
  from: "Customer@Example.COM",  // mixed case to test lowercasing
  fromName: "Alice Customer",
  subject: "My order hasn't arrived",
  body: "I placed order #12345 three weeks ago and haven't heard back.",
};
```

## 201 response shape
- `id` — number (Prisma auto-increment integer)
- `subject` — string, echoed verbatim
- `senderEmail` — lowercased version of `from`
- `senderName` — echoed verbatim
- `createdAt` — ISO-8601 string

## Validation error shape
`{ error: "<message from Zod issues[0]>" }`

Errors tested:
- Missing `fromName` → `"Sender name is required"`
- Missing `subject` → `"Subject is required"`
- Missing `body` → `"Body is required"`
- Missing `from` → `"A valid sender email is required"`
- Invalid email in `from` → `"A valid sender email is required"`
- Whitespace-only `fromName`, `subject`, `body` → same messages (schema uses `.trim().min(1)`)
- Completely empty body → 400 with some string error

## Patterns to reuse
- Destructure and spread to omit a field: `const { fieldName: _omitted, ...rest } = VALID_PAYLOAD`
- `test.skip(condition, reason)` — Playwright skips at runtime with a clear message; use for env-gated tests
- Parallel requests to assert distinct IDs: `Promise.all([request.post(...), request.post(...)])`
