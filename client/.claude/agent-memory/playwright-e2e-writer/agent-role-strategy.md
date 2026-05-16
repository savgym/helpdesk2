---
name: agent-role-strategy
description: How to test AGENT role behavior — no real agent in test DB, use page.route() to mock the session API
metadata:
  type: project
---

The test database seed (`server/src/prisma/seed.ts`) only creates ONE user: the admin, from ADMIN_EMAIL/ADMIN_PASSWORD env vars. There is no seeded agent user.

**Strategy for agent role tests:** Use `page.route()` to intercept `GET /api/auth/session` and return a fake AGENT user object before navigating. This makes the AuthProvider believe the user is logged in as an agent without a real DB record.

Also intercept `POST /api/auth/sign-out` to return `{ success: true }` so that logout still works cleanly in tests that call it.

**Helper:** `mockAgentSession(page)` in `e2e/fixtures/auth.ts` handles both intercepts.

**Important:** Call `mockAgentSession(page)` BEFORE `page.goto(...)` so the route handler is in place when the page mounts and AuthProvider fires its session check.

**Why:** No agent seed exists and creating one via the DB in global-setup would add fragility (password hashing, Better Auth-specific user format). Mocking the session endpoint is cleaner and tests the exact behavior we care about (role-based redirects in the React app).
