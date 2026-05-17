import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, ADMIN } from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates an agent user directly through the API (session cookie is already
 * established by loginAsAdmin). Returns the created user object.
 */
async function createAgentViaApi(
  page: Page,
  overrides: { name?: string; email?: string; password?: string } = {}
) {
  const email = overrides.email ?? `agent-${Date.now()}@helpdesk.test`;
  const response = await page.request.post("/api/users", {
    data: {
      name: overrides.name ?? "Test Agent",
      email,
      password: overrides.password ?? "agentpassword1",
    },
  });
  if (!response.ok()) {
    throw new Error(
      `createAgentViaApi failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json() as Promise<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
}

/**
 * Navigates to /users and waits for the table to finish loading (skeleton rows
 * must be gone and at least the admin row must be visible).
 */
async function goToUsersPage(page: Page) {
  await page.goto("/users");
  // Wait for the admin row to appear — email is unique and unambiguous.
  await expect(
    page.getByRole("row").filter({ hasText: ADMIN.email })
  ).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Read — list
// ---------------------------------------------------------------------------

test.describe("Users page — list", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToUsersPage(page);
  });

  test("renders the page heading and New User button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New User" })
    ).toBeVisible();
  });

  test("renders the table column headers", async ({ page }) => {
    for (const header of ["Name", "Email", "Role", "Created", "Actions"]) {
      await expect(
        page.getByRole("columnheader", { name: header })
      ).toBeVisible();
    }
  });

  test("shows the admin user row with name, email and role badge", async ({
    page,
  }) => {
    const adminRow = page.getByRole("row").filter({ hasText: ADMIN.email });

    // Use first() to target the Name cell specifically (partial match "Admin" is ambiguous)
    await expect(adminRow.getByRole("cell").first()).toContainText(ADMIN.name);
    await expect(adminRow.getByRole("cell", { name: ADMIN.email })).toBeVisible();
    // Role badge renders the lowercase value — exact: true avoids matching email/name
    await expect(adminRow.getByText("admin", { exact: true })).toBeVisible();
  });

  test("marks the current user's row with '(you)'", async ({ page }) => {
    const adminRow = page.getByRole("row").filter({ hasText: ADMIN.email });
    await expect(adminRow.getByText("(you)")).toBeVisible();
  });

  test("admin row does not have a trash/delete icon", async ({ page }) => {
    const adminRow = page.getByRole("row").filter({ hasText: ADMIN.email });
    // The delete button has an sr-only span with text "Delete".
    // It must not exist on the admin's own row.
    await expect(adminRow.getByRole("button", { name: "Delete" })).not.toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

test.describe("Users page — create", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToUsersPage(page);
  });

  test("opens the 'Create new user' dialog when New User is clicked", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New User" }).click();
    await expect(
      page.getByRole("dialog", { name: "Create new user" })
    ).toBeVisible();
  });

  test("dialog contains Name, Email and Password fields plus a Create user button", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New User" }).click();
    const dialog = page.getByRole("dialog", { name: "Create new user" });

    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByLabel("Email")).toBeVisible();
    await expect(dialog.getByLabel("Password")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Create user" })
    ).toBeVisible();
  });

  test("creating a user adds them to the table without a page reload", async ({
    page,
  }) => {
    const email = `new-agent-${Date.now()}@helpdesk.test`;
    const name = "New E2E Agent";

    await page.getByRole("button", { name: "New User" }).click();
    const dialog = page.getByRole("dialog", { name: "Create new user" });

    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill("securepassword1");

    // Intercept the POST so we can wait for it to complete
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/users") &&
        res.request().method() === "POST" &&
        res.status() === 201
    );
    await dialog.getByRole("button", { name: "Create user" }).click();
    await responsePromise;

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // New row must appear in the table
    const newRow = page.getByRole("row").filter({ hasText: email });
    await expect(newRow).toBeVisible();
    await expect(newRow.getByRole("cell", { name: name })).toBeVisible();
    await expect(newRow.getByText("agent", { exact: true })).toBeVisible();
  });

  test("dialog closes when Cancel is clicked without creating a user", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New User" }).click();
    const dialog = page.getByRole("dialog", { name: "Create new user" });

    await dialog.getByLabel("Name").fill("Ghost User");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible();
    // The ghost user must not appear in the table
    await expect(
      page.getByRole("cell", { name: "Ghost User" })
    ).not.toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Update (edit)
// ---------------------------------------------------------------------------

test.describe("Users page — edit", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens the 'Edit user' dialog pre-populated with the user's current data", async ({
    page,
  }) => {
    const agent = await createAgentViaApi(page);
    await goToUsersPage(page);

    const agentRow = page.getByRole("row").filter({ hasText: agent.email });
    await agentRow.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit user" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue(agent.name);
    await expect(dialog.getByLabel("Email")).toHaveValue(agent.email);
    // Password field is empty by default in edit mode
    await expect(dialog.getByLabel("Password")).toHaveValue("");
    await expect(dialog.getByLabel("Password")).toHaveAttribute(
      "placeholder",
      "Leave blank to keep current password"
    );
  });

  test("saving an edited name updates the row in the table without a page reload", async ({
    page,
  }) => {
    const agent = await createAgentViaApi(page);
    await goToUsersPage(page);

    const agentRow = page.getByRole("row").filter({ hasText: agent.email });
    await agentRow.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit user" });
    const nameField = dialog.getByLabel("Name");
    await nameField.clear();
    await nameField.fill("Renamed Agent");

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/users/${agent.id}`) &&
        res.request().method() === "PATCH" &&
        res.status() === 200
    );
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await responsePromise;

    // Dialog must close
    await expect(dialog).not.toBeVisible();

    // The row now shows the updated name
    const updatedRow = page.getByRole("row").filter({ hasText: agent.email });
    await expect(
      updatedRow.getByRole("cell", { name: "Renamed Agent" })
    ).toBeVisible();
  });

  test("edit dialog closes when Cancel is clicked and name reverts", async ({
    page,
  }) => {
    const agent = await createAgentViaApi(page);
    await goToUsersPage(page);

    const agentRow = page.getByRole("row").filter({ hasText: agent.email });
    await agentRow.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit user" });
    const nameField = dialog.getByLabel("Name");
    await nameField.clear();
    await nameField.fill("Should Not Save");

    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible();
    // Original name still present — scope by email since many rows share the same name
    await expect(
      page.getByRole("row").filter({ hasText: agent.email })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Should Not Save" })
    ).not.toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

test.describe("Users page — delete", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows a confirmation AlertDialog when the trash icon is clicked", async ({
    page,
  }) => {
    const agent = await createAgentViaApi(page);
    await goToUsersPage(page);

    const agentRow = page.getByRole("row").filter({ hasText: agent.email });
    await agentRow.getByRole("button", { name: "Delete" }).click();

    // AlertDialog must appear and its description must contain the user's email
    const alertDialog = page.getByRole("alertdialog", { name: "Delete user?" });
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog).toContainText(agent.email);
  });

  test("clicking Cancel in the delete dialog keeps the user in the table", async ({
    page,
  }) => {
    const agent = await createAgentViaApi(page);
    await goToUsersPage(page);

    const agentRow = page.getByRole("row").filter({ hasText: agent.email });
    await agentRow.getByRole("button", { name: "Delete" }).click();

    await page.getByRole("button", { name: "Cancel" }).click();

    // AlertDialog closed
    await expect(
      page.getByRole("alertdialog", { name: "Delete user?" })
    ).not.toBeVisible();
    // Row still in the table
    await expect(
      page.getByRole("row").filter({ hasText: agent.email })
    ).toBeVisible();
  });

  test("confirming delete removes the user row from the table without a page reload", async ({
    page,
  }) => {
    const agent = await createAgentViaApi(page);
    await goToUsersPage(page);

    const agentRow = page.getByRole("row").filter({ hasText: agent.email });
    await agentRow.getByRole("button", { name: "Delete" }).click();

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/users/${agent.id}`) &&
        res.request().method() === "DELETE" &&
        res.status() === 204
    );

    // Click the destructive "Delete" button inside the AlertDialog
    const alertDialog = page.getByRole("alertdialog", { name: "Delete user?" });
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    await responsePromise;

    // Row must be gone from the table
    await expect(
      page.getByRole("row").filter({ hasText: agent.email })
    ).not.toBeAttached();
  });

  test("admin row does not show a delete button", async ({ page }) => {
    await goToUsersPage(page);
    const adminRow = page.getByRole("row").filter({ hasText: ADMIN.email });
    await expect(
      adminRow.getByRole("button", { name: "Delete" })
    ).not.toBeAttached();
  });
});
