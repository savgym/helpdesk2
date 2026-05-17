---
name: project-e2e-setup
description: E2E test infrastructure — ports, DB, playwright config, auth fixtures, run commands
metadata:
  type: project
---

## Ports
- Client (E2E): http://localhost:5174 (uses vite.config.e2e.ts)
- Server (E2E): http://localhost:3001 (proxied via vite E2E config)
- Normal dev ports are 5173 / 3000 — never use those in E2E tests

## Test database
- Name: `helpdesk_test`
- Config: `server/.env.test` — contains `DATABASE_URL` pointing to `helpdesk_test`
- Seeded by `global-setup.ts` which runs `bun src/prisma/seed.ts` with the test env

## Auth helpers — `client/e2e/fixtures/auth.ts`
- `loginAsAdmin(page)` — real login against test server, waits for `/dashboard`
- `loginAs(page, email, password)` — generic real login
- `mockAgentSession(page)` — mocks `GET /api/auth/get-session` with a fake AGENT user; no real agent exists in test DB
- `ADMIN` — `{ email, password, name, role }` from env or defaults to `admin@helpdesk.test` / `test-admin-password-123`
- `AGENT_MOCK` — fake agent object for session mocking only

## Playwright config
- `playwright.config.ts` at `client/` root
- `testDir: ./e2e`, `outputDir: ./e2e/test-results`
- `fullyParallel: false`, `workers: 1` (tests share the same test DB)
- `globalSetup: ./e2e/global-setup.ts`
- Projects: chromium only

## Run commands (from `client/`)
```bash
bun test:e2e        # headless
bun test:e2e:ui     # Playwright UI mode
```

## API requests in tests
- `page.request.post/patch/delete` share the session cookie established by `loginAsAdmin`
- Use `page.waitForResponse(predicate)` to await API round-trips instead of `waitForTimeout`
