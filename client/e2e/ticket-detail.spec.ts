import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, mockAgentSession, AGENT_MOCK } from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

async function seedTicket(
  request: APIRequestContext,
  overrides: { from?: string; fromName?: string; subject?: string; body?: string } = {}
) {
  const response = await request.post("/api/inbound/email", {
    data: {
      from: overrides.from ?? "customer@example.com",
      fromName: overrides.fromName ?? "Jane Smith",
      subject: overrides.subject ?? `Test ticket ${Date.now()}`,
      body: overrides.body ?? "This is a test email body.",
    },
  });
  if (!response.ok()) {
    throw new Error(`seedTicket failed: ${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<{ id: number; subject: string; createdAt: string }>;
}

// ---------------------------------------------------------------------------
// Mock data for mocked-session tests
// ---------------------------------------------------------------------------

const MOCK_AGENT_USER = {
  id: "agent-abc",
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
  id: 123,
  assignedTo: { id: MOCK_AGENT_USER.id, name: MOCK_AGENT_USER.name, email: MOCK_AGENT_USER.email },
};

// ---------------------------------------------------------------------------
// Content rendering — real DB ticket
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — content rendering", () => {
  const RUN_ID = Date.now();
  const SUBJECT = `Detail page test ${RUN_ID}`;
  const BODY = "Please help me with my account — I cannot log in.";
  const SENDER_NAME = "Carol Sender";
  const SENDER_EMAIL = "carol@example.com";

  let ticketId: number;

  test.beforeAll(async ({ request }) => {
    const ticket = await seedTicket(request, {
      subject: SUBJECT,
      body: BODY,
      fromName: SENDER_NAME,
      from: SENDER_EMAIL,
    });
    ticketId = ticket.id;
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate via the tickets list to follow the real user flow
    await page.goto("/tickets");
    await expect(page.getByRole("link", { name: SUBJECT })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("link", { name: SUBJECT }).click();
    await page.waitForURL(/\/tickets\/\d+/, { timeout: 10_000 });
  });

  test("renders the ticket subject as the page h1", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: SUBJECT })).toBeVisible();
  });

  test("renders the status badge as lowercase 'open'", async ({ page }) => {
    await expect(page.getByText("open", { exact: true })).toBeVisible();
  });

  test("renders the category text", async ({ page }) => {
    await expect(page.getByText("technical question")).toBeVisible();
  });

  test("renders the sender name and email in the meta grid", async ({ page }) => {
    await expect(
      page.getByText(`${SENDER_NAME} (${SENDER_EMAIL})`)
    ).toBeVisible();
  });

  test("renders the original message body", async ({ page }) => {
    await expect(page.getByText(BODY)).toBeVisible();
  });

  test("renders the message card heading 'Message' with the sender name", async ({ page }) => {
    // The "Message" heading sits inside the original-message card
    await expect(page.getByText("Message", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`From ${SENDER_NAME}`)).toBeVisible();
  });

  test("renders a visible 'Back to tickets' link", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Back to tickets" })).toBeVisible();
  });

  test("renders the 'Assigned to' select with 'Unassigned' as the default value", async ({
    page,
  }) => {
    // The combobox trigger should be visible; no agent is assigned
    const trigger = page.getByRole("combobox");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText("Unassigned");
  });
});

// ---------------------------------------------------------------------------
// Back link navigation — real DB ticket
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — back link navigation", () => {
  let ticketId: number;

  test.beforeAll(async ({ request }) => {
    const ticket = await seedTicket(request, {
      subject: `Back link test ${Date.now()}`,
    });
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
// Assign to agent — fully mocked (no real login round-trip)
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — assign to agent (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock session so the AuthProvider sees an authenticated user without a
    // real login request.
    await mockAgentSession(page);

    // Mock GET /api/tickets/123 — unassigned ticket
    await page.route("**/api/tickets/123", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TICKET_UNASSIGNED),
        });
      } else {
        // Let PATCH calls fall through to the handler set up per-test
        await route.continue();
      }
    });

    // Mock GET /api/users — return the single fake agent
    await page.route("**/api/users", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_AGENT_USER]),
      });
    });
  });

  test("shows 'Unassigned' in the Select when the ticket has no assignee", async ({
    page,
  }) => {
    await page.goto("/tickets/123");
    const trigger = page.getByRole("combobox");
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await expect(trigger).toContainText("Unassigned");
  });

  test("selecting an agent sends PATCH /api/tickets/123 with the correct assignedToId", async ({
    page,
  }) => {
    // Capture the PATCH body before navigating
    let patchBody: Record<string, unknown> | null = null;

    await page.route("**/api/tickets/123", async (route) => {
      if (route.request().method() !== "PATCH") {
        // GET is already handled in beforeEach; continue everything else
        await route.continue();
        return;
      }
      patchBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 123,
          assignedTo: {
            id: MOCK_AGENT_USER.id,
            name: MOCK_AGENT_USER.name,
            email: MOCK_AGENT_USER.email,
          },
        }),
      });
    });

    await page.goto("/tickets/123");

    // Wait for the page to finish loading — h1 and combobox must be present
    await expect(
      page.getByRole("heading", { level: 1, name: MOCK_TICKET_UNASSIGNED.subject })
    ).toBeVisible({ timeout: 10_000 });

    // Open the Radix Select
    await page.getByRole("combobox").click();
    // Choose the mocked agent from the dropdown
    await page.getByRole("option", { name: MOCK_AGENT_USER.name }).click();

    // Wait for the PATCH to fire
    await page.waitForResponse(
      (res) => res.url().includes("/api/tickets/123") && res.request().method() === "PATCH",
      { timeout: 10_000 }
    );

    expect(patchBody).not.toBeNull();
    expect(patchBody!.assignedToId).toBe(MOCK_AGENT_USER.id);
  });

  test("the Select shows the agent name after assignment (optimistic cache update)", async ({
    page,
  }) => {
    await page.route("**/api/tickets/123", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 123,
          assignedTo: {
            id: MOCK_AGENT_USER.id,
            name: MOCK_AGENT_USER.name,
            email: MOCK_AGENT_USER.email,
          },
        }),
      });
    });

    await page.goto("/tickets/123");
    await expect(
      page.getByRole("heading", { level: 1, name: MOCK_TICKET_UNASSIGNED.subject })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: MOCK_AGENT_USER.name }).click();

    // After the mutation resolves, the Select trigger should now display the agent name
    await expect(page.getByRole("combobox")).toContainText(MOCK_AGENT_USER.name, {
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Unassign — fully mocked
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — unassign (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAgentSession(page);

    // Ticket starts assigned to MOCK_AGENT_USER
    await page.route("**/api/tickets/123", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TICKET_ASSIGNED),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/users", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_AGENT_USER]),
      });
    });
  });

  test("shows the assigned agent name in the Select when the ticket is already assigned", async ({
    page,
  }) => {
    await page.goto("/tickets/123");
    await expect(
      page.getByRole("heading", { level: 1, name: MOCK_TICKET_ASSIGNED.subject })
    ).toBeVisible({ timeout: 10_000 });

    const trigger = page.getByRole("combobox");
    await expect(trigger).toContainText(MOCK_AGENT_USER.name);
  });

  test("selecting 'Unassigned' sends PATCH with assignedToId: null", async ({ page }) => {
    let patchBody: Record<string, unknown> | null = null;

    await page.route("**/api/tickets/123", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      patchBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 123, assignedTo: null }),
      });
    });

    await page.goto("/tickets/123");
    await expect(
      page.getByRole("heading", { level: 1, name: MOCK_TICKET_ASSIGNED.subject })
    ).toBeVisible({ timeout: 10_000 });

    // Open the Select — it currently shows the agent name
    await page.getByRole("combobox").click();
    // Choose the "Unassigned" option
    await page.getByRole("option", { name: "Unassigned" }).click();

    await page.waitForResponse(
      (res) => res.url().includes("/api/tickets/123") && res.request().method() === "PATCH",
      { timeout: 10_000 }
    );

    expect(patchBody).not.toBeNull();
    expect(patchBody!.assignedToId).toBeNull();
  });

  test("the Select reverts to 'Unassigned' after a successful unassign", async ({ page }) => {
    await page.route("**/api/tickets/123", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 123, assignedTo: null }),
      });
    });

    await page.goto("/tickets/123");
    await expect(
      page.getByRole("heading", { level: 1, name: MOCK_TICKET_ASSIGNED.subject })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Unassigned" }).click();

    // After the mutation resolves the trigger should show "Unassigned"
    await expect(page.getByRole("combobox")).toContainText("Unassigned", {
      timeout: 10_000,
    });
  });
});
