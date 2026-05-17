---
name: tickets-page-patterns
description: Seeding, selector, and ordering patterns for TicketsPage / TicketsTable E2E tests
metadata:
  type: reference
---

## Inbound webhook for seeding

`POST /api/inbound/email` (no auth required in test env — WEBHOOK_SECRET is not set in server/.env.test).

Required body fields: `from` (email), `fromName`, `subject`, `body`.

Returns `{ id, subject, senderEmail, senderName, createdAt }` with status 201.

Use the Playwright `request` fixture (APIRequestContext) in `test.beforeAll` — it is automatically scoped to `baseURL` (http://localhost:5174), which the e2e Vite config proxies to the test server at port 3001.

## TicketsTable selectors

- Page heading: `page.getByRole("heading", { name: "Tickets" })`
- Column headers: `page.getByRole("columnheader", { name: <col> })` for Subject / Status / Category / From / Received
- Subject link: `page.getByRole("link", { name: subject })` — each subject cell is a `<Link>` (renders as `<a>`)
- Target a specific row by its subject: `page.getByRole("row").filter({ has: page.getByRole("link", { name: subject }) })`
- Status badge: within the row, `row.getByText("open", { exact: true })` — status is lowercased in the DOM
- Category null: `row.getByText("—")` — rendered as a `<span>` when category is null
- From column: `row.getByText(senderName)` and `row.getByText(senderEmail)` — name in `div.text-sm`, email in `div.text-xs.text-muted-foreground`
- Empty state: `page.getByRole("cell", { name: "No tickets yet." })` — colSpan=5 cell

## Ordering test pattern

Seed with a 50 ms delay between the two calls to guarantee distinct `createdAt`. Then collect all rows containing a link with `page.getByRole("row").filter({ has: page.getByRole("link") })`, iterate by index, and compare DOM positions. The API returns newest-first so the second-seeded ticket must have a lower DOM index.

## Test isolation approach

- Tickets persist across test runs (global-setup only cleans non-admin Users, not Tickets).
- Use a `Date.now()` suffix in subjects to make each run's tickets unique — assert with `toContainText` / exact name match on that unique subject, never on row count.
- Empty-state test: mock `GET /api/tickets` with `page.route("**/api/tickets", ...)` returning `[]` rather than touching the DB.

## Route

`/tickets/:id` — subject link navigates there; URL pattern is `/tickets/<numeric-id>`. Assert with `page.waitForURL(/\/tickets\/\d+/)`.

## Server-side sorting

**Sort icon `data-testid` pattern** (added to TicketsTable.tsx):
- `sort-icon-<columnId>-asc` — ChevronUp (ascending active)
- `sort-icon-<columnId>-desc` — ChevronDown (descending active)
- `sort-icon-<columnId>-none` — ChevronsUpDown (not sorted)

Column IDs match TanStack Table accessor keys: `subject`, `senderName`, `status`, `category`, `createdAt`.

**Default sort state**: `createdAt desc` — on page load `sort-icon-createdAt-desc` is visible and all others show `-none`.

**`sortDescFirst: false`** means the first click on an unsorted column produces `sortOrder=asc`, the second click produces `sortOrder=desc`.

**`withMockedTickets(page, fn)` helper pattern**: arms `page.route("**/api/tickets**")` before calling `fn()`, captures every intercepted request URL into an array, unroutes after `fn()` resolves, returns the URL array. Use this for all sort indicator / query param tests — avoids DB dependency, gives stable row content (`SORT_MOCK_TICKETS`), and lets you assert query params post-hoc via `capturedUrls.find(u => u.searchParams.get("sortBy") === "subject")`.

**Selector for column header click**: `page.getByRole("columnheader", { name: /subject/i })`. For Status use `{ name: /^status$/i }` to avoid partial match with "Category" or other words.
