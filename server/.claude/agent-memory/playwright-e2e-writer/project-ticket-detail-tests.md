---
name: project-ticket-detail-tests
description: Selectors, mock data shapes, and patterns used for ticket-detail.spec.ts
metadata:
  type: project
---

## File location
`client/e2e/ticket-detail.spec.ts`

## Component structure (TicketDetailPage.tsx)
- `GET /api/tickets/:id` → `TicketDetail` object (subject, body, status, category, senderEmail, senderName, assignedTo, messages)
- `GET /api/users` → `Agent[]` for the Assigned-to Select dropdown
- `PATCH /api/tickets/:id` body: `{ assignedToId: string | null }` → returns `{ id, assignedTo }`
- The Assigned-to field is a Radix UI `Select` (shadcn) — open with `page.getByRole("combobox")`, choose with `page.getByRole("option", { name: "..." })`
- Status badge renders `ticket.status.toLowerCase()` (e.g. "open")
- Category renders from `CATEGORY_LABEL` map, e.g. `TECHNICAL_QUESTION` → "technical question"
- `assignedTo` is set to `null` for unassigned; the Select default shows "Unassigned"
- After PATCH success, `queryClient.setQueryData` updates the cache — the Select trigger updates without a page reload

## Key selectors
- Page heading: `page.getByRole("heading", { level: 1, name: subject })`
- Back link: `page.getByRole("link", { name: "Back to tickets" })`
- Assign Select trigger: `page.getByRole("combobox")`
- Agent option in dropdown: `page.getByRole("option", { name: agentName })`
- Unassign option: `page.getByRole("option", { name: "Unassigned" })`
- Status badge: `page.getByText("open", { exact: true })`
- Sender line: `page.getByText("${senderName} (${senderEmail})")`
- Message card heading: `page.getByText("Message", { exact: true }).first()`
- Sender in message card: `page.getByText("From ${senderName}")`

## Navigation pattern (for real DB tests)
- Navigate via `/tickets` list, click subject link, `page.waitForURL(/\/tickets\/\d+/)`
- Direct navigation also works: `page.goto("/tickets/${ticketId}")` for simpler tests

## Mocked-session tests (assign/unassign)
- Use `mockAgentSession(page)` from `./fixtures/auth` — mocks `GET /api/auth/get-session` and `POST /api/auth/sign-out`
- Must mock ALL three APIs before navigating: session, `/api/tickets/123`, `/api/users`
- Route handler pattern: check `route.request().method()` inside a single `page.route("**/api/tickets/123", ...)` handler, `route.continue()` for methods you don't handle
- PATCH body capture: `route.request().postDataJSON()` — call before `route.fulfill()`
- Wait for PATCH: `page.waitForResponse(res => res.url().includes("/api/tickets/123") && res.request().method() === "PATCH")`

## Mock data shapes
```ts
// Unassigned ticket
{ id: 123, subject, body, status: "OPEN", category: "TECHNICAL_QUESTION",
  senderEmail, senderName, createdAt, updatedAt, assignedTo: null, messages: [] }

// Assigned ticket — same but with assignedTo: { id, name, email }

// Agent user for /api/users
{ id: "agent-abc", name: "Alice Agent", email: "alice@helpdesk.test", role: "AGENT" }
```

## Describe block strategy
1. "Content rendering" — `beforeAll` seeds one real ticket, `beforeEach` logs in + navigates via list; covers h1, badge, category, sender, body, message card, back link, Select default
2. "Back link navigation" — seeds ticket, navigates directly, clicks back link, asserts URL
3. "Assign to agent (mocked)" — `mockAgentSession` + mocked APIs; covers default Unassigned, PATCH body, cache update
4. "Unassign (mocked)" — same mocking pattern but ticket starts assigned; covers PATCH null body, cache update
