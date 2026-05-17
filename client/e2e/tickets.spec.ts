import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { loginAsAdmin } from "./fixtures/auth";

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
// Navigation — subject link
// ---------------------------------------------------------------------------

test.describe("Tickets page — navigation", () => {
  let subject: string;

  test.beforeAll(async ({ request }) => {
    const ticket = await seedTicket(request, { subject: `Nav test ${Date.now()}` });
    subject = ticket.subject;
  });

  test("clicking the subject link navigates to /tickets/:id", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/tickets");
    await expect(page.getByRole("link", { name: subject })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("link", { name: subject }).click();
    await page.waitForURL(/\/tickets\/\d+/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/tickets\/\d+/);
  });
});

// ---------------------------------------------------------------------------
// Ordering — newest first
// ---------------------------------------------------------------------------

test.describe("Tickets page — newest first ordering", () => {
  const RUN_ID = Date.now();
  const SUBJECT_FIRST = `First ticket ordering-test ${RUN_ID}`;
  const SUBJECT_SECOND = `Second ticket ordering-test ${RUN_ID}`;

  test.beforeAll(async ({ request }) => {
    await seedTicket(request, { subject: SUBJECT_FIRST });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await seedTicket(request, { subject: SUBJECT_SECOND });
  });

  test("the second-seeded ticket appears before the first-seeded ticket in the table", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/tickets");
    await expect(page.getByRole("link", { name: SUBJECT_SECOND })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: SUBJECT_FIRST })).toBeVisible();

    const rows = page.getByRole("row").filter({ has: page.getByRole("link") });
    const count = await rows.count();

    let indexFirst = -1;
    let indexSecond = -1;
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).innerText();
      if (text.includes(SUBJECT_SECOND)) indexSecond = i;
      if (text.includes(SUBJECT_FIRST)) indexFirst = i;
    }

    expect(indexSecond).toBeGreaterThanOrEqual(0);
    expect(indexFirst).toBeGreaterThanOrEqual(0);
    expect(indexSecond).toBeLessThan(indexFirst);
  });
});

// ---------------------------------------------------------------------------
// Server-side sorting — sort indicators and query params
// ---------------------------------------------------------------------------

/**
 * A stable set of tickets used across all sorting tests. Returned in the order
 * the mock supplies them so we can assert row position without touching the DB.
 */
const SORT_MOCK_TICKETS = [
  {
    id: 1,
    subject: "Alpha ticket",
    status: "CLOSED",
    category: "GENERAL_QUESTION",
    senderEmail: "alice@example.com",
    senderName: "Alice",
    createdAt: "2026-01-01T10:00:00.000Z",
  },
  {
    id: 2,
    subject: "Beta ticket",
    status: "OPEN",
    category: "TECHNICAL_QUESTION",
    senderEmail: "bob@example.com",
    senderName: "Bob",
    createdAt: "2026-01-02T10:00:00.000Z",
  },
  {
    id: 3,
    subject: "Gamma ticket",
    status: "RESOLVED",
    category: "REFUND_REQUEST",
    senderEmail: "carol@example.com",
    senderName: "Carol",
    createdAt: "2026-01-03T10:00:00.000Z",
  },
];

/**
 * Intercept GET /api/tickets for the duration of fn(), capturing the URL of
 * every intercepted request. Returns those captured URLs after fn() resolves.
 *
 * The mock always responds with SORT_MOCK_TICKETS regardless of query params —
 * these tests care about which params were sent, not about DB-level reordering.
 */
async function withMockedTickets(
  page: Page,
  fn: () => Promise<void>
): Promise<URL[]> {
  const capturedUrls: URL[] = [];

  await page.route("**/api/tickets**", (route) => {
    capturedUrls.push(new URL(route.request().url()));
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SORT_MOCK_TICKETS),
    });
  });

  await fn();

  await page.unroute("**/api/tickets**");
  return capturedUrls;
}

test.describe("Tickets page — sort indicators", () => {
  test("on page load the Created column shows the desc icon and all other columns show the neutral icon", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await withMockedTickets(page, async () => {
      await page.goto("/tickets");
      // Wait for the table to finish loading
      await expect(page.getByRole("link", { name: "Alpha ticket" })).toBeVisible(
        { timeout: 10_000 }
      );

      // Created column: descending chevron visible
      await expect(
        page.getByTestId("sort-icon-createdAt-desc")
      ).toBeVisible();

      // All other columns: neutral double-chevron visible, no directional icon
      for (const col of ["subject", "senderName", "status", "category"]) {
        await expect(page.getByTestId(`sort-icon-${col}-none`)).toBeVisible();
        await expect(page.getByTestId(`sort-icon-${col}-asc`)).not.toBeAttached();
        await expect(page.getByTestId(`sort-icon-${col}-desc`)).not.toBeAttached();
      }

      // Created column must not show the neutral or asc icon
      await expect(page.getByTestId("sort-icon-createdAt-none")).not.toBeAttached();
      await expect(page.getByTestId("sort-icon-createdAt-asc")).not.toBeAttached();
    });
  });
});

test.describe("Tickets page — sort by Subject", () => {
  test("first click on Subject sends sortBy=subject&sortOrder=asc and shows the asc icon", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const capturedUrls = await withMockedTickets(page, async () => {
      await page.goto("/tickets");
      await expect(
        page.getByRole("link", { name: "Alpha ticket" })
      ).toBeVisible({ timeout: 10_000 });

      // Re-arm the route before clicking so the click's request is captured
      // (withMockedTickets already armed it; clicking will trigger a new fetch)
      await page.getByRole("columnheader", { name: /subject/i }).click();

      // Wait for the table to re-render with mocked data
      await expect(page.getByRole("link", { name: "Alpha ticket" })).toBeVisible(
        { timeout: 10_000 }
      );

      // Subject header now shows the asc icon
      await expect(page.getByTestId("sort-icon-subject-asc")).toBeVisible();
      await expect(page.getByTestId("sort-icon-subject-none")).not.toBeAttached();
      await expect(page.getByTestId("sort-icon-subject-desc")).not.toBeAttached();

      // Created header returns to neutral
      await expect(page.getByTestId("sort-icon-createdAt-none")).toBeVisible();
    });

    // The second captured request (after the click) must carry the correct params
    const sortRequest = capturedUrls.find((u) => u.searchParams.get("sortBy") === "subject");
    expect(sortRequest, "expected a request with sortBy=subject").toBeDefined();
    expect(sortRequest!.searchParams.get("sortOrder")).toBe("asc");
  });

  test("second click on Subject sends sortBy=subject&sortOrder=desc and shows the desc icon", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const capturedUrls = await withMockedTickets(page, async () => {
      await page.goto("/tickets");
      await expect(
        page.getByRole("link", { name: "Alpha ticket" })
      ).toBeVisible({ timeout: 10_000 });

      const subjectHeader = page.getByRole("columnheader", { name: /subject/i });

      // First click: asc
      await subjectHeader.click();
      await expect(page.getByTestId("sort-icon-subject-asc")).toBeVisible({
        timeout: 10_000,
      });

      // Second click: desc
      await subjectHeader.click();
      await expect(page.getByTestId("sort-icon-subject-desc")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByTestId("sort-icon-subject-asc")).not.toBeAttached();
      await expect(page.getByTestId("sort-icon-subject-none")).not.toBeAttached();
    });

    const descRequest = capturedUrls.find(
      (u) =>
        u.searchParams.get("sortBy") === "subject" &&
        u.searchParams.get("sortOrder") === "desc"
    );
    expect(descRequest, "expected a request with sortBy=subject&sortOrder=desc").toBeDefined();
  });
});

test.describe("Tickets page — sort by different column", () => {
  test("clicking Status header sends sortBy=status&sortOrder=asc, shows asc icon on Status, and resets Subject to neutral", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const capturedUrls = await withMockedTickets(page, async () => {
      await page.goto("/tickets");
      await expect(
        page.getByRole("link", { name: "Alpha ticket" })
      ).toBeVisible({ timeout: 10_000 });

      // First sort by Subject so it has a directional icon, then switch to Status
      const subjectHeader = page.getByRole("columnheader", { name: /subject/i });
      await subjectHeader.click();
      await expect(page.getByTestId("sort-icon-subject-asc")).toBeVisible({
        timeout: 10_000,
      });

      // Now click Status
      await page.getByRole("columnheader", { name: /^status$/i }).click();
      await expect(page.getByTestId("sort-icon-status-asc")).toBeVisible({
        timeout: 10_000,
      });

      // Status shows ascending icon
      await expect(page.getByTestId("sort-icon-status-asc")).toBeVisible();
      await expect(page.getByTestId("sort-icon-status-none")).not.toBeAttached();
      await expect(page.getByTestId("sort-icon-status-desc")).not.toBeAttached();

      // Subject returns to neutral
      await expect(page.getByTestId("sort-icon-subject-none")).toBeVisible();
      await expect(page.getByTestId("sort-icon-subject-asc")).not.toBeAttached();
    });

    const statusRequest = capturedUrls.find(
      (u) =>
        u.searchParams.get("sortBy") === "status" &&
        u.searchParams.get("sortOrder") === "asc"
    );
    expect(
      statusRequest,
      "expected a request with sortBy=status&sortOrder=asc"
    ).toBeDefined();
  });
});
