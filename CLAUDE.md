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

## Testing strategy

**Default to component tests. Use E2E only when a test cannot be written at the component level.**

### When to write component tests (default)
- Rendering: loading states, empty states, column headers, badges, conditional content
- Data display: correct fields shown, formatting, labels derived from enums
- User interactions: button clicks, form submissions, dialog open/close
- Error states: fetch failures, validation messages
- Any behaviour that can be exercised by mocking `../lib/api`

### When to write E2E tests (exceptions only)
- Real browser navigation — clicking a link and asserting the URL changed
- Multi-step flows that cross page boundaries (e.g. login → redirect → protected page)
- Server-side ordering or DB state that cannot be meaningfully mocked (e.g. newest-first sort)
- Auth and route-guard flows (`auth.spec.ts` already covers these — do not duplicate)

If a test only needs mocked data and DOM assertions, it is a component test, not E2E.

## Component testing (Vitest + React Testing Library)

```bash
cd client
bun run test          # run all component tests once
bun run test:ui       # open Vitest browser UI (best for writing tests)
```

### Setup
- Config: `client/vitest.config.ts` — jsdom environment, `src/test/setup.ts` as setup file, e2e files excluded
- Setup file (`src/test/setup.ts`) — imports `@testing-library/jest-dom` matchers and stubs `ResizeObserver`, `matchMedia`, and pointer-capture APIs required by Radix UI primitives
- Test files live next to the component they test: `src/components/TicketsTable.test.tsx`
- Components that use `<Link>` require a `<MemoryRouter>` wrapper — `renderWithQuery` does not include one, so wrap manually when needed

### Conventions
- Use `renderWithQuery` from `src/test/renderWithQuery.tsx` instead of bare `render` — it wraps the component in a fresh `QueryClientProvider` with `retry: false`
- Mock `../lib/api` with `vi.mock` — never make real HTTP calls in component tests
- Mock `../context/AuthContext` with `vi.mock` to control the current user
- Radix UI primitives (Select, etc.) do not work in jsdom — mock the shadcn component with a native HTML equivalent (e.g. `<select>`) so interactions work reliably
- User fixtures must include all `AuthUser` fields: `id`, `name`, `email`, `role`, `emailVerified`, `image`, `createdAt`, `updatedAt`
- Use `userEvent.setup()` for all interactions; prefer `findBy*` queries for async state

## E2E testing (Playwright)

See the `playwright-e2e-writer` agent (`client/.claude/agents/playwright-e2e-writer.md`) for the full setup, ports, credentials, and test-writing guidelines.

```bash
cd client
bun test:e2e       # headless
bun test:e2e:ui    # Playwright UI mode
```

Use the `playwright-e2e-writer` agent to write E2E tests — do not write Playwright tests inline. Only invoke it for the cases listed in "When to write E2E tests" above. The agent knows the correct ports, test database, credentials, auth fixture pattern, and file naming conventions for this project.

## Key conventions

- All API routes are prefixed with `/api` (e.g. `/api/health`, `/api/tickets`)
- The Vite dev server proxies `/api/*` to `http://localhost:3000` without path rewriting
- Client API calls go through `client/src/lib/api.ts` — use `api.get / post / patch / delete` (axios-based, `withCredentials: true`)
- Bun is the runtime and package manager for both `client` and `server`
- **All API routes must use `requireAuth` middleware server-side** — client-side guards alone are not sufficient
- **Use Zod for all request body validation in server routes** — define schemas at the top of each route file, parse with `safeParse`, and return `res.status(400).json({ error: result.error.issues[0].message })` on failure. Never use manual `if (!field)` checks.
- **Use react-hook-form + zod for all forms on the client** — define a `z.object` schema, infer the type with `z.infer`, pass `zodResolver(schema)` to `useForm`, use `register` on inputs, and display errors from `formState.errors`. Wrap the form in `<form onSubmit={handleSubmit(onSubmit)} noValidate>`. Never use manual `useState` form state or manual validation functions.
- **Shared Zod schemas live in the `core` package** (`@helpdesk/core`) — any schema used by both client and server must be defined in `core/src/schemas/` and exported from `core/src/index.ts`. Import from `@helpdesk/core` in both client and server. Never duplicate a schema across packages.
- **Never wrap route handlers in try/catch** — the server runs Express 5, which automatically forwards rejected promises to the global error handler. Only catch errors when you need to handle them specially (e.g. map a specific error to a 409).

## Data fetching (client)

- **Always use TanStack Query** (`@tanstack/react-query`) for server state — never `useEffect` + `useState` for fetching
- `useQuery` for reads; `useMutation` for writes (POST / PATCH / DELETE)
- Update the cache directly in `onSuccess` via `queryClient.setQueryData` — avoid unnecessary refetches
- `QueryClientProvider` is set up in `client/src/main.tsx`
- **Never use `fetch` directly** — always go through the axios wrapper in `client/src/lib/api.ts`
- Add TanStack Query and Axios to context7 lookups when working with either library

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
- Session is checked on mount via `GET /api/auth/get-session` (returns `{ user }` or `null` when unauthenticated — never a 401)
- `login(email, password)` → `POST /api/auth/sign-in/email`
- `logout()` → `POST /api/auth/sign-out`
- All HTTP calls go through the axios instance in `client/src/lib/api.ts` — **never use `fetch` directly**
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
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router v6, TanStack Query v5, Axios |
| Backend  | Node.js, Express 4, TypeScript, Helmet, express-rate-limit              |
| Database | PostgreSQL 16 (Docker)                                                  |
| ORM      | Prisma 6                                                                |
| AI       | Claude API (Anthropic)                                                  |
| Email    | SendGrid or Mailgun (inbound webhook + outbound)                        |
| Runtime  | Bun                                                                     |
| Testing  | Vitest + React Testing Library (component), Playwright (E2E)            |

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

Libraries to always look up via context7: React, React Router, Vite, Tailwind CSS, Prisma, Express, Bun, Anthropic SDK, SendGrid, Mailgun, Playwright, TanStack Query, Axios.
