import type { Page } from "@playwright/test";

export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@helpdesk.test",
  password: process.env.ADMIN_PASSWORD ?? "test-admin-password-123",
  name: "Admin",
  role: "ADMIN" as const,
};

/**
 * A fake AGENT user object used to mock the session API.
 * There is no real agent in the test database — use mockAgentSession()
 * instead of trying to log in as this user against the real server.
 */
export const AGENT_MOCK = {
  id: "mock-agent-id",
  name: "Test Agent",
  email: "agent@helpdesk.test",
  role: "AGENT" as const,
  emailVerified: true,
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Performs a real login against the test server and waits for redirect to /dashboard.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

/**
 * Logs in as the seeded admin user.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, ADMIN.email, ADMIN.password);
}

/**
 * Intercepts GET /api/auth/session to return a fake AGENT user.
 * Call this before navigating so the AuthProvider picks up the mocked session.
 * Also intercepts POST /api/auth/sign-out so logout still works cleanly.
 */
export async function mockAgentSession(page: Page): Promise<void> {
  await page.route("**/api/auth/get-session", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: AGENT_MOCK }),
    });
  });

  await page.route("**/api/auth/sign-out", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}
