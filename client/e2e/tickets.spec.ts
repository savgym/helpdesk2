import { test, expect, type APIRequestContext } from "@playwright/test";
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
