---
name: project-e2e-infra
description: E2E test infrastructure — ports, config file locations, global-setup behavior, vite e2e config, seed
metadata:
  type: project
---

The HelpDesk project has a pre-existing, partially set up Playwright environment inside `client/`.

**Ports**
- Frontend (test): 5174 (vite.config.e2e.ts), proxies /api to localhost:3001
- Backend (test): 3001 (reads server/.env.test)

**Key files**
- `client/playwright.config.ts` — existing config, do not recreate
- `client/vite.config.e2e.ts` — e2e-specific Vite config, port 5174, proxy to 3001
- `client/e2e/global-setup.ts` — creates helpdesk_test DB, runs prisma migrate deploy, runs seed.ts
- `client/e2e/fixtures/auth.ts` — created; contains loginAs, loginAsAdmin, mockAgentSession, ADMIN, AGENT_MOCK

**Test credentials (server/.env.test)**
- ADMIN_EMAIL=admin@helpdesk.test
- ADMIN_PASSWORD=test-admin-password-123

**Seed behavior**
- `server/src/prisma/seed.ts` creates ONE admin user from env vars; skips if user already exists
- No agent user is seeded — agent role tests must use page.route() mocking

**Config highlights**
- fullyParallel: false, workers: 1 (serial execution)
- globalSetup points to e2e/global-setup.ts
- webServer for backend uses `bun src/index.ts` with env from .env.test
- webServer for frontend uses `vite --config vite.config.e2e.ts`
