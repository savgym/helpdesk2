import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, mockAgentSession } from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

async function seedTicket(
  request: Parameters<typeof test>[1] extends { request: infer R } ? R : never,
  overrides: { subject?: string } = {}
) {
  const response = await request.post("/api/inbound/email", {
    data: {
      from: "customer@example.com",
      fromName: "Jane Smith",
      subject: overrides.subject ?? `Test ticket ${Date.now()}`,
      body: "This is a test email body.",
    },
  });
  if (!response.ok()) {
    throw new Error(`seedTicket failed: ${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<{ id: number }>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_AGENT = {
  id: "agent-1",
  name: "Alice Agent",
  email: "alice@helpdesk.test",
  role: "AGENT" as const,
};

const MOCK_TICKET_UNASSIGNED = {
  id: 123,
  subject: "Mocked unassigned ticket",
  body: "The printer on floor 3 is not working.",
  status: "OPEN",
  category: "TECHNICAL_QUESTION",
  senderEmail: "customer@example.com",
  senderName: "Bob Customer",
  createdAt: "2026-01-10T09:00:00.000Z",
  updatedAt: "2026-01-10T09:00:00.000Z",
  assignedTo: null,
  messages: [],
};

const MOCK_TICKET_ASSIGNED = {
  ...MOCK_TICKET_UNASSIGNED,
  assignedTo: { id: MOCK_AGENT.id, name: MOCK_AGENT.name, email: MOCK_AGENT.email },
};

const MOCK_TICKET_EMPTY = {
  id: 457,
  subject: "Ticket without replies",
  body: "I need help with my order.",
  status: "OPEN" as const,
  category: null,
  senderEmail: "eve@example.com",
  senderName: "Eve Customer",
  createdAt: "2026-03-01T08:00:00.000Z",
  updatedAt: "2026-03-01T08:00:00.000Z",
  assignedTo: null,
  messages: [],
};

/**
 * Arms session + GET for a ticket + users. Call before page.goto().
 */
async function setupMockedPage(
  page: Page,
  ticketId: number,
  ticket: object,
  agents: object[] = []
) {
  await mockAgentSession(page);
  await page.route(`**/api/tickets/${ticketId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ticket),
      });
    } else {
      await route.continue();
    }
  });
  await page.route("**/api/users", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(agents),
    });
  });
}

// ---------------------------------------------------------------------------
// Back-link navigation — real browser navigation (E2E only: URL change)
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — navigation", () => {
  let ticketId: number;

  test.beforeAll(async ({ request }) => {
    const ticket = await seedTicket(request, { subject: `Nav test ${Date.now()}` });
    ticketId = ticket.id;
  });

  test("clicking 'Back to tickets' navigates to /tickets", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByRole("link", { name: "Back to tickets" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("link", { name: "Back to tickets" }).click();
    await page.waitForURL("/tickets", { timeout: 10_000 });
    await expect(page).toHaveURL("/tickets");
  });
});

// ---------------------------------------------------------------------------
// Radix Select → PATCH flows (E2E only: Radix is mocked as native <select> in
// unit tests, so only a real browser can verify the dropdown interaction)
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — sidebar selects (mocked)", () => {
  test.describe("assign / unassign", () => {
    test("selecting an agent sends PATCH with the correct assignedToId", async ({ page }) => {
      await setupMockedPage(page, 123, MOCK_TICKET_UNASSIGNED, [MOCK_AGENT]);

      let patchBody: Record<string, unknown> | null = null;
      await page.route("**/api/tickets/123", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.fallback();
          return;
        }
        patchBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: 123, status: "OPEN", category: "TECHNICAL_QUESTION", assignedTo: { id: MOCK_AGENT.id, name: MOCK_AGENT.name, email: MOCK_AGENT.email } }),
        });
      });

      await page.goto("/tickets/123");
      await expect(
        page.getByRole("heading", { level: 1, name: MOCK_TICKET_UNASSIGNED.subject })
      ).toBeVisible({ timeout: 10_000 });

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/tickets/123") && res.request().method() === "PATCH"
      );
      await page.getByRole("combobox").filter({ hasText: "Unassigned" }).click();
      await page.getByRole("option", { name: MOCK_AGENT.name }).click();
      await responsePromise;

      expect(patchBody).not.toBeNull();
      expect(patchBody!.assignedToId).toBe(MOCK_AGENT.id);
    });

    test("selecting 'Unassigned' sends PATCH with assignedToId: null", async ({ page }) => {
      await setupMockedPage(page, 123, MOCK_TICKET_ASSIGNED, [MOCK_AGENT]);

      let patchBody: Record<string, unknown> | null = null;
      await page.route("**/api/tickets/123", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.fallback();
          return;
        }
        patchBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: 123, status: "OPEN", category: "TECHNICAL_QUESTION", assignedTo: null }),
        });
      });

      await page.goto("/tickets/123");
      await expect(
        page.getByRole("heading", { level: 1, name: MOCK_TICKET_ASSIGNED.subject })
      ).toBeVisible({ timeout: 10_000 });

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/tickets/123") && res.request().method() === "PATCH"
      );
      await page.getByRole("combobox").filter({ hasText: MOCK_AGENT.name }).click();
      await page.getByRole("option", { name: "Unassigned" }).click();
      await responsePromise;

      expect(patchBody).not.toBeNull();
      expect(patchBody!.assignedToId).toBeNull();
    });
  });

  test.describe("status and category", () => {
    test("changing the Status select fires PATCH with the new status value", async ({ page }) => {
      await setupMockedPage(page, 457, MOCK_TICKET_EMPTY, []);

      let patchBody: Record<string, unknown> | null = null;
      await page.route("**/api/tickets/457", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.fallback();
          return;
        }
        patchBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: 457, status: "RESOLVED", category: null, assignedTo: null }),
        });
      });

      await page.goto("/tickets/457");
      await expect(
        page.getByRole("heading", { level: 1, name: MOCK_TICKET_EMPTY.subject })
      ).toBeVisible({ timeout: 10_000 });

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/tickets/457") && res.request().method() === "PATCH"
      );
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Resolved" }).click();
      await responsePromise;

      expect(patchBody).not.toBeNull();
      expect(patchBody!.status).toBe("RESOLVED");
    });

    test("changing the Category select fires PATCH with the new category value", async ({ page }) => {
      await setupMockedPage(page, 457, MOCK_TICKET_EMPTY, []);

      let patchBody: Record<string, unknown> | null = null;
      await page.route("**/api/tickets/457", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.fallback();
          return;
        }
        patchBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: 457, status: "OPEN", category: "GENERAL_QUESTION", assignedTo: null }),
        });
      });

      await page.goto("/tickets/457");
      await expect(
        page.getByRole("heading", { level: 1, name: MOCK_TICKET_EMPTY.subject })
      ).toBeVisible({ timeout: 10_000 });

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/tickets/457") && res.request().method() === "PATCH"
      );
      await page.getByRole("combobox").nth(1).click();
      await page.getByRole("option", { name: "General" }).click();
      await responsePromise;

      expect(patchBody).not.toBeNull();
      expect(patchBody!.category).toBe("GENERAL_QUESTION");
    });
  });
});

// ---------------------------------------------------------------------------
// Reply end-to-end (E2E only: the full chain POST → onSuccess → setQueryData
// → TicketDetail re-render cannot be verified without a real browser)
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — send reply (mocked)", () => {
  const REPLY_TEXT = "Thanks for reaching out — we will resolve this shortly.";
  const NEW_MESSAGE = {
    id: "msg-new",
    body: REPLY_TEXT,
    senderType: "AGENT" as const,
    createdAt: new Date().toISOString(),
  };

  test("typing a reply and clicking Send Reply adds the new card to the thread", async ({
    page,
  }) => {
    await setupMockedPage(page, 457, MOCK_TICKET_EMPTY, []);
    await page.route("**/api/tickets/457/messages", (route) => {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(NEW_MESSAGE),
      });
    });

    await page.goto("/tickets/457");
    await expect(
      page.getByRole("heading", { level: 1, name: MOCK_TICKET_EMPTY.subject })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Write your reply...").fill(REPLY_TEXT);
    await page.getByRole("button", { name: "Send Reply" }).click();

    // The new agent reply card must appear in the thread without a page reload
    await expect(page.getByText(REPLY_TEXT)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Agent", { exact: true })).toBeVisible();
  });
});
