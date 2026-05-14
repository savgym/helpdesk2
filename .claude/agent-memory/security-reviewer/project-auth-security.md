---
name: project-auth-security
description: Security audit findings for HelpDesk auth and authorization layer — key patterns, risks, and verified behaviors
metadata:
  type: project
---

Security audit conducted 2026-05-14. Key findings and architectural facts:

**Better Auth secret fallback (verified in source)**
When `BETTER_AUTH_SECRET` env var is missing or empty, Better Auth falls back to the hardcoded string `"better-auth-secret-12345678901234567890"` (line 80 of `@better-auth/core/dist/context/create-context.mjs`). This only throws in `NODE_ENV=production`. In dev/staging without NODE_ENV set, a predictable secret is silently used — session tokens become forgeable.

**CORS split-brain (verified)**
`server/src/app.ts` CORS config uses `process.env.CLIENT_URL || "http://localhost:5173"` (single origin string).
`server/src/lib/auth.ts` trustedOrigins uses `(process.env.TRUSTED_ORIGINS ?? "").split(",")`.
These two configs are independent and can diverge — CORS and Better Auth origin trust can be misconfigured independently.

**No API routes yet (verified)**
As of audit date the server only has `/api/health` (unauthenticated, safe) and `/api/auth/*`. No ticket or user API routes exist yet. Authorization enforcement gaps are a future risk as routes are added.

**Admin-only enforcement is frontend-only (current state)**
`/users` page is guarded by `AdminRoute` client-side component only. No server-side admin middleware exists yet. When API routes for user management are added, they must include server-side role checks.

**Cookie security (verified from Better Auth source)**
Better Auth sets `httpOnly: true`, `sameSite: "lax"` by default. `Secure` flag is set only when `NODE_ENV=production` or HTTPS is detected — not set in development. No explicit `domain` or `path` restriction observed.

**No rate limiting anywhere** — login endpoint (`/api/auth/sign-in/email`) has no brute-force protection.

**No security headers** — helmet is not installed or configured.

**Docker exposes DB publicly** — `docker-compose.yml` maps `5432:5432` on all interfaces with default credentials (`helpdesk/helpdesk`).

**Session token exposed to client** — `AuthContext.tsx` stores the full session object (including `token` field) in the `SessionResponse` type, received from `/api/auth/session`. The session token is accessible to client JS (though not used for auth — cookie is). This is low risk but worth noting.

**No input validation on server** — `express.json()` has no size limit configured.

**Seed security** — correctly reads credentials from env vars, no hardcoded passwords. Seed `betterAuth` instance lacks `disableSignUp`, but it's a one-off CLI script not exposed as an HTTP endpoint.

**Context7 API key committed to git** — Both `/.mcp.json` and `/client/.mcp.json` are git-tracked and contain a live `CONTEXT7_API_KEY` value (`ctx7sk-bf451526...`). No remote exists yet but must be gitignored before any remote push.

**Admin credentials in settings.local.json** — `.claude/settings.local.json` is git-tracked and contains a hardcoded curl command with `email:admin@helpdesk.com` and `password:admin123`. This is a development credential committed to version control.

**Schema migration drift** — The single migration file (`20260510080817_init`) was written for the pre-Better-Auth schema (User.passwordHash NOT NULL, old Session). The current `schema.prisma` has the Better Auth schema (Account, Verification, Session.token). No migration was generated after the Better Auth switch — migration history is unusable for a fresh production deploy.

**No global error handler in Express** — `app.ts` has no 4-argument error middleware. Express's default error handler sends the full stack trace as HTML in development. The auth handler calls `next(err)` which hits this default.

**Password hashing** — Better Auth uses scrypt (N=16384, r=16, p=1, dkLen=64, 32MB memory) via `@better-auth/utils`. Comparison uses string `===` not `crypto.timingSafeEqual` — library code, not ours. Low practical impact due to scrypt's inherent slowness. Passwords stored in `Account.password` (nullable), not on User model.

**Why this matters:** HelpDesk will process customer email data and have email webhook integrations. The no-rate-limit and no-secret-validation-in-dev findings are the highest priority before any production deployment.

**How to apply:** When reviewing future API route additions, always check for: (1) auth middleware applied, (2) role check for admin operations, (3) input validation with size limits. Before any git remote is added, ensure .mcp.json files and settings.local.json are gitignored and cleaned from history.
