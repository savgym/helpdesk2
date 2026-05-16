---
name: auth-selectors
description: Confirmed Playwright selectors for LoginPage, Layout navbar, and auth guard components — derived from reading source
metadata:
  type: project
---

## LoginPage (`client/src/pages/LoginPage.tsx`)

- Heading: `page.getByRole("heading", { name: "Helpdesk" })`
- Description: `page.getByText("Sign in to your account")`
- Email input: `page.getByLabel(/email/i)` — placeholder "you@example.com", type="email"
- Password input: `page.getByLabel(/password/i)` — placeholder "Enter your password", type="password"
- Submit button (idle): `page.getByRole("button", { name: "Sign in" })`
- Submit button (submitting): `page.getByRole("button", { name: /signing in/i })` — text is "Signing in…", button is disabled
- Server error paragraph: `p.text-destructive` (or `p.text-sm.text-destructive`) — rendered above the form fields when `serverError` state is set
- Inline email error: `page.getByText("Enter a valid email address")` — zod message
- Inline password error: `page.getByText("Password is required")` — zod message
- aria-invalid: email input gets `aria-invalid="true"` when validation fails

**No `data-testid` attributes exist on this component.**

## Layout (`client/src/components/Layout.tsx`)

- Brand text: `page.getByText("Helpdesk").first()` (also appears in LoginPage heading, use .first())
- Nav link Dashboard: `page.getByRole("link", { name: "Dashboard" })`
- Nav link Tickets: `page.getByRole("link", { name: "Tickets" })`
- Nav link Users (ADMIN only): `page.getByRole("link", { name: "Users" })` — only rendered when `user.role === "ADMIN"`
- Logout button: `page.getByRole("button", { name: "Sign out" })` — plain `<button>`, not a link
- User name display: `page.getByText(user.name)` — shown as a `<span>`

## ProtectedRoute / AdminRoute

- No DOM output to test directly — behavior is redirect-based
- Loading state renders: `<span class="text-sm text-gray-400">Loading…</span>` — visible only briefly
- ProtectedRoute redirects to /login when no user
- AdminRoute redirects to /dashboard when user.role !== "ADMIN"

## AuthContext session check

- On mount: GET /api/auth/session → returns `{ user }` (authenticated) or `null` (unauthenticated) — never 401
- Login: POST /api/auth/sign-in/email with `{ email, password }`
- Logout: POST /api/auth/sign-out with `{}`
- All fetches use `credentials: "include"` (cookie-based sessions)
- Error format from api.ts: reads `error.message || error.error || "Request failed"`
