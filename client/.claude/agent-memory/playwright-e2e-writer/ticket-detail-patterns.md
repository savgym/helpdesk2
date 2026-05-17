---
name: ticket-detail-patterns
description: Selectors, mock fixtures, and interaction patterns for TicketDetailPage E2E tests
metadata:
  type: reference
---

## File location

`client/e2e/ticket-detail.spec.ts` — all ticket detail tests live here. Do not create a separate file.

## Mock IDs in use

The following ticket IDs are reserved for fully-mocked tests to avoid collisions with real DB tickets:

- `123` — used in assign/unassign describe blocks (MOCK_TICKET_UNASSIGNED / MOCK_TICKET_ASSIGNED)
- `456` — MOCK_TICKET_WITH_MESSAGES (has a CUSTOMER follow-up + AGENT reply in messages[])
- `457` — MOCK_TICKET_EMPTY_MESSAGES (no messages, category null, status OPEN)
- `999` — used in error-state test (GET returns 500)

## setupMockedPage() helper

Defined at module level in the spec file (below the unassign describe block). Takes `(page, ticketId, ticket, agents?)` and arms:
1. `mockAgentSession(page)` — no real login
2. `page.route("**/api/tickets/${ticketId}", ...)` — fulfills GET, continues everything else
3. `page.route("**/api/users", ...)` — fulfills with agents array

Use this for any new mocked describe block instead of duplicating the three route calls.

## Key selectors

- Page h1: `page.getByRole("heading", { level: 1, name: subject })`
- All sidebar Select triggers: `page.getByRole("combobox")` — there are 3 in DOM order: Status (0), Category (1), Assigned To (2)
- Status trigger: `page.getByRole("combobox").first()`
- Category trigger: `page.getByRole("combobox").nth(1)`
- AssignedTo trigger: `page.getByRole("combobox")` (only one in the original tests, because assign tests use ID 123 which has a different route)
- Select options: `page.getByRole("option", { name: "..." })` — Radix renders them in a portal
- Reply textarea: `page.getByPlaceholder("Write your reply...")`
- Send Reply button: `page.getByRole("button", { name: "Send Reply" })`
- Back link: `page.getByRole("link", { name: "Back to tickets" })`
- Customer badge text: `page.getByText("Customer")` — appears once per customer message (original + any follow-ups)
- Agent badge text: `page.getByText("Agent")`
- Agent reply header label: `page.getByText("Reply", { exact: true })` — exact needed because "Reply" also appears in the form section heading
- Loading skeleton: `page.locator(".animate-pulse").first()` — Skeleton component always adds animate-pulse
- Error div: `page.locator(".text-destructive")` — present when ticket fetch fails

## Reply thread DOM structure

Original message card:
- heading "Message" + Badge "Customer"
- `From {senderName} · {date}` subtitle
- `{body}` text

Subsequent messages (ticket.messages[]):
- CUSTOMER: heading "Message" + Badge "Customer"
- AGENT: heading "Reply" + Badge "Agent", From line shows assignedTo?.name ?? "Agent"

## Status / Category labels

STATUS_LABEL: OPEN → "Open", RESOLVED → "Resolved", CLOSED → "Closed"
CATEGORY_LABEL: GENERAL_QUESTION → "General", TECHNICAL_QUESTION → "Technical", REFUND_REQUEST → "Refund"
Null category renders as "Uncategorized" in the Select trigger.

## ReplyForm validation

Schema: `createMessageSchema` from `@helpdesk/core` — `body: z.string().min(1, "Reply cannot be empty")`
Empty submit: shows "Reply cannot be empty", does NOT fire POST.
Success: `reset()` is called, textarea returns to "".

## PATCH response shape (updateTicket)

```json
{ "id": number, "status": TicketStatus, "category": TicketCategory | null, "assignedTo": { id, name, email } | null }
```

The `onSuccess` handler uses `setQueryData` to merge the three fields into the cached ticket. No refetch.

## Route for messages

`POST /api/tickets/:id/messages` — returns 201 with `{ id, body, senderType, createdAt }`.
The `onSuccess` handler in TicketDetailPage appends the returned message to `ticket.messages` via `setQueryData`.
