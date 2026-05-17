---
name: project-users-crud
description: Selectors, patterns, and API shape discovered while writing users.spec.ts
metadata:
  type: project
---

## File location
`client/e2e/users.spec.ts`

## Component structure (as of May 2026)
- `UsersPage` — renders heading, "New User" button, `UsersTable`, and a `UserDialog` for create
- `UsersTable` — TanStack Query fetch of `GET /api/users`; renders shadcn `Table`; inline `AlertDialog` for delete; opens `UserDialog` for edit
- `UserDialog` — react-hook-form + zod; `id="user-name"`, `id="user-email"`, `id="user-password"`; dialog title is "Create new user" or "Edit user"

## Key selectors
- Admin row: `page.getByRole("row").filter({ hasText: ADMIN.email })`
- Edit button: `getByRole("button", { name: "Edit" })` (has `<span className="sr-only">Edit</span>`)
- Delete button: `getByRole("button", { name: "Delete" })` (has `<span className="sr-only">Delete</span>`)
- Create dialog: `page.getByRole("dialog", { name: "Create new user" })`
- Edit dialog: `page.getByRole("dialog", { name: "Edit user" })`
- Delete confirmation: `page.getByRole("alertdialog", { name: "Delete user?" })`
- Role badge: `getByText("admin")` / `getByText("agent")` (lowercase)

## API shape (server/src/controllers/users.ts)
- `GET  /api/users`        → `User[]` ordered by `createdAt asc`
- `POST /api/users`        → 201 `User`; 409 if email exists
- `PATCH /api/users/:id`   → 200 `User`; 409 if email taken
- `DELETE /api/users/:id`  → 204; soft-delete (`deletedAt`), signs out sessions

## Test data pattern
- Create a fresh agent user via `page.request.post("/api/users", ...)` after `loginAsAdmin`
- Session cookie is shared between `page` and `page.request` — no extra auth needed
- Use `Date.now()` in email to guarantee uniqueness per test run

## Guard rules (UI-enforced, also server-enforced)
- Admin users: no trash icon (`canDelete = !isSelf && u.role !== "ADMIN"`)
- Current user: shows "(you)" label next to name
- No delete button on the current user's own row (`isSelf` check)

## Loading state
- Table shows 5 skeleton rows during initial fetch
- Wait for `page.getByRole("cell", { name: ADMIN.name })` before interacting (reliable signal that data loaded)
