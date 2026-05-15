# HelpDesk — Claude Project Memory

## What this project is

An AI-powered ticket management system that receives support emails, auto-classifies them, generates AI summaries and suggested replies, and lets agents manage tickets through a dashboard.

See `project-scope.md` for full requirements and `implementation-plan.md` for the phased build plan.

## Monorepo structure

```
helpDesk/
├── client/          # React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + React Router
│   ├── e2e/         # Playwright E2E tests and global setup
│   ├── playwright.config.ts
│   └── vite.config.e2e.ts   # E2E vite config (port 5174, proxies to :3001)
├── server/          # Node.js + Express + TypeScript + Prisma
│   └── src/middleware/requireAuth.ts  # requireAuth / requireAdmin middleware
├── docker-compose.yml
└── implementation-plan.md
```

## Running the project

```bash
# Start PostgreSQL
docker compose up -d

# Server (port 3000)
cd server && bun dev

# Client (port 5173)
cd client && bun dev
```

First-time setup:

```bash
cd server
bunx prisma migrate deploy
bun src/prisma/seed.ts   # creates admin user using ADMIN_EMAIL / ADMIN_PASSWORD from server/.env
```

## E2E testing (Playwright)

Tests run against a separate `helpdesk_test` database on isolated ports to avoid conflicts with dev servers.

| Service | Dev | E2E |
|---------|-----|-----|
| Express | :3000 | :3001 |
| Vite | :5173 | :5174 |

```bash
cd client
bun test:e2e       # headless
bun test:e2e:ui    # Playwright UI mode
```

`global-setup.ts` runs automatically before tests and:
1. Creates `helpdesk_test` DB if it doesn't exist
2. Runs `prisma migrate deploy` against it
3. Seeds the test admin user (idempotent)

Test env config lives in `server/.env.test` (gitignored). Test admin: `admin@helpdesk.test` / see `.env.test`.

## Key conventions

- All API routes are prefixed with `/api` (e.g. `/api/health`, `/api/tickets`)
- The Vite dev server proxies `/api/*` to `http://localhost:3000` without path rewriting
- Client API calls go through `client/src/lib/api.ts` — use `api.get / post / patch / delete`
- Bun is the runtime and package manager for both `client` and `server`
- **All API routes must use `requireAuth` middleware server-side** — client-side guards alone are not sufficient

## Authentication

Auth is handled by **Better Auth** (`better-auth` package).

### Server

- Config: `server/src/lib/auth.ts` — Prisma adapter (PostgreSQL), email/password enabled, **sign-up disabled** (agents are created via seed/admin only)
- All Better Auth routes are mounted at `/api/auth/*` via `toNodeHandler(auth)` in `app.ts`
- The `User` model has an additional `role` field (`ADMIN | AGENT`), set server-side only (`input: false`)
- Required env vars: `BETTER_AUTH_SECRET` (min 32 chars — server won't start without it), `BETTER_AUTH_URL`, `CLIENT_URL`, `TRUSTED_ORIGINS`
- Security middleware in `app.ts`: `helmet()`, `express.json({ limit: "50kb" })`, global error handler, rate limiting on `/api/auth/sign-in` (production only)

### Server-side route protection

`server/src/middleware/requireAuth.ts` exports two middleware functions. Apply to every API route:

```typescript
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

router.get("/tickets", requireAuth, handler);          // any logged-in user
router.get("/users", requireAuth, requireAdmin, handler); // admin only
```

`requireAuth` sets `res.locals.session`. `requireAdmin` reuses it when chained.

### Client

- `AuthContext` (`client/src/context/AuthContext.tsx`) — wraps the app, exposes `user`, `isLoading`, `login`, `logout`
- Session is checked on mount via `GET /api/auth/session` (returns `{ user }` or `null` when unauthenticated — never a 401)
- `login(email, password)` → `POST /api/auth/sign-in/email`
- `logout()` → `POST /api/auth/sign-out`
- All `fetch` calls use `credentials: "include"` (cookie-based sessions)
- `ProtectedRoute` (`client/src/components/ProtectedRoute.tsx`) — redirects to `/login` if no user; shows a loading state while session resolves
- `AdminRoute` (`client/src/components/AdminRoute.tsx`) — nested inside `ProtectedRoute`; redirects non-admins to `/dashboard`
- `useAuth()` hook — throws if used outside `AuthProvider`

### Creating new users

Sign-up is disabled in the production auth config. To create a new user, run a one-off Bun script using the `seedAuth` pattern from `server/src/prisma/seed.ts` (a separate `betterAuth` instance without `disableSignUp`), then update `role` via Prisma if needed.

## Client routing

| Path           | Guard          | Page             |
| -------------- | -------------- | ---------------- |
| `/dashboard`   | ProtectedRoute | DashboardPage    |
| `/tickets`     | ProtectedRoute | TicketsPage      |
| `/tickets/:id` | ProtectedRoute | TicketDetailPage |
| `/users`       | AdminRoute     | UsersPage        |

The navbar (`Layout.tsx`) renders the Users link only when `user.role === "ADMIN"`.

## Tech stack

| Layer    | Choice                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router v6 |
| Backend  | Node.js, Express 4, TypeScript, Helmet, express-rate-limit              |
| Database | PostgreSQL 16 (Docker)                                                  |
| ORM      | Prisma 6                                                                |
| AI       | Claude API (Anthropic)                                                  |
| Email    | SendGrid or Mailgun (inbound webhook + outbound)                        |
| Runtime  | Bun                                                                     |
| Testing  | Playwright (E2E)                                                        |

## Database models

- `User` — id, name, email, emailVerified, image, role (ADMIN | AGENT)
- `Account` — Better Auth account model (stores hashed password via scrypt)
- `Session` — Better Auth session model (token-based, httpOnly cookie)
- `Verification` — Better Auth verification tokens
- `Ticket` — id, subject, body, status (OPEN | RESOLVED | CLOSED), category (GENERAL_QUESTION | TECHNICAL_QUESTION | REFUND_REQUEST), senderEmail, assignedToId
- `Message` — id, ticketId, body, senderType (CUSTOMER | AGENT)

## Using context7 for documentation

Always use the context7 MCP server when working with any library or framework in this project. This ensures up-to-date docs rather than relying on training data.

Before writing code that uses a library, resolve its ID and fetch relevant docs:

```
1. mcp__context7__resolve-library-id  →  find the library ID
2. mcp__context7__query-docs          →  fetch the relevant section
```

Libraries to always look up via context7: React, React Router, Vite, Tailwind CSS, Prisma, Express, Bun, Anthropic SDK, SendGrid, Mailgun, Playwright.
