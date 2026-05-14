---
name: project-security-state
description: Current security posture of the HelpDesk monorepo — what is fixed, what is open, and what is structural
metadata:
  type: project
---

Security audit conducted 2026-05-14. Second-pass review covering auth/authorization. Prior critical issues (API key in git, admin creds in git, migration schema mismatch) were confirmed resolved.

**Open issues (not yet fixed) as of this audit:**

1. [HIGH] `server/src/lib/auth.ts` — `BETTER_AUTH_SECRET` has no startup guard in application code. Better Auth itself will use the fallback `better-auth-secret-12345678901234567890` if the env var is unset; it only throws in production mode. In development this is silently insecure. Add an explicit check in `index.ts` before `app.listen`.

2. [HIGH] `server/.env.example` — placeholder secret `"change-this-in-production"` is shorter than 32 chars and low-entropy. Better Auth will warn but not throw. The example should show the `openssl rand -base64 32` output placeholder.

3. [HIGH] `server/src/app.ts` — `express.json()` has no body size limit (line 22). Default is 100 kb in older Express, but no explicit limit is set. Before routes are added this needs `express.json({ limit: '50kb' })`.

4. [HIGH] `docker-compose.yml` line 5 — Postgres port `"5432:5432"` is bound to `0.0.0.0`, exposing the DB on all interfaces. Should be `"127.0.0.1:5432:5432"`.

5. [HIGH] `server/src/app.ts` — No `helmet` middleware. Security headers (CSP, X-Content-Type-Options, X-Frame-Options, HSTS, etc.) are absent.

6. [HIGH] `server/src/app.ts` — No rate limiting on the login endpoint (`/api/auth/sign-in/email`). Credential stuffing / brute-force is unrestricted.

7. [HIGH] No `server/src/middleware/` directory exists — no `requireAuth` or `requireAdmin` middleware has been implemented yet. When API routes for tickets/users are added, there is no reusable server-side auth guard to apply.

8. [MEDIUM] `client/src/context/AuthContext.tsx` lines 17-27 — `SessionResponse` interface includes `session.token` (the raw session token). The `/api/auth/session` GET endpoint does return the token field in the JSON body (confirmed by reading Better Auth source). This token is stored in React state in the browser JS heap. It is also returned on sign-in. It is not needed by the client (auth is cookie-based); storing it in state is unnecessary exposure.

9. [MEDIUM] `client/src/pages/LoginPage.tsx` line 64 — Email input placeholder is `admin@example.com`. This hints at the admin account name to any visitor and should be a generic placeholder like `you@yourcompany.com`.

10. [MEDIUM] `server/src/app.ts` — No global Express error handler (4-arg `(err, req, res, next)`). Unhandled errors propagate to Express's default handler, which may leak stack traces in production.

11. [LOW] `server/src/app.ts` line 10 — CORS `origin` is a single string from `CLIENT_URL`. If `CLIENT_URL` is ever a comma-separated list (like `TRUSTED_ORIGINS`), this breaks silently. Low risk currently since it's one value, but should be noted.

**Architecture security notes:**
- `input: false` on the `role` field in `auth.ts` correctly prevents clients from self-assigning roles.
- `disableSignUp: true` on the production auth instance prevents self-registration.
- `credentials: "include"` is used on all client fetch calls.
- `ProtectedRoute` and `AdminRoute` frontend guards are present; AdminRoute correctly checks `user.role !== "ADMIN"`.
- Cookie defaults from Better Auth: `httpOnly: true`, `sameSite: "lax"`. `secure` flag is set when `BETTER_AUTH_URL` starts with `https://` — relies on the URL env var being correct in production.
- No `dangerouslySetInnerHTML`, no localStorage/sessionStorage use for auth data found in client.
- No hardcoded secrets found in source files.
- `server/.env` is not tracked by git (confirmed).

**Why / How to apply:**
The project is in early phase (pages are mostly stubs). As API routes for tickets and users are built, the missing `requireAuth`/`requireAdmin` middleware gap becomes the most urgent structural risk. All the HIGH findings should be fixed before any additional routes are shipped.
