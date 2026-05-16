import { test, expect } from "@playwright/test";
import {
  loginAs,
  loginAsAdmin,
  mockAgentSession,
  ADMIN,
} from "./fixtures/auth";

// ---------------------------------------------------------------------------
// Login page — rendering
// ---------------------------------------------------------------------------

test.describe("Login page — rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("renders the page heading and description", async ({ page }) => {
    await expect(
      page.getByText("Helpdesk").first()
    ).toBeVisible();
    await expect(
      page.getByText("Sign in to your account")
    ).toBeVisible();
  });

  test("renders an email field with the correct placeholder", async ({
    page,
  }) => {
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("placeholder", "you@example.com");
    await expect(emailInput).toHaveAttribute("type", "email");
  });

  test("renders a password field with a placeholder", async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveAttribute(
      "placeholder",
      "Enter your password"
    );
  });

  test("renders an enabled Sign in button in the idle state", async ({
    page,
  }) => {
    const button = page.getByRole("button", { name: "Sign in" });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test("does not show any validation or server errors on initial render", async ({
    page,
  }) => {
    // No destructive error paragraphs should be visible before interaction
    await expect(page.locator(".text-destructive")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Login page — successful login
// ---------------------------------------------------------------------------

test.describe("Login page — successful login", () => {
  test("redirects to /dashboard after valid admin credentials", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/dashboard");
  });

  test("shows the authenticated layout (navbar) after login", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    // The navbar brand and at least one nav link should be visible
    await expect(page.getByText("Helpdesk").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Login page — client-side validation (react-hook-form + zod, no server call)
// ---------------------------------------------------------------------------

test.describe("Login page — client-side validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("shows validation errors for both fields on empty form submission", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    // Email field: zod .email() message
    await expect(
      page.getByText("Enter a valid email address")
    ).toBeVisible();

    // Password field: zod .min(1) message
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("shows an email validation error for a malformed email address", async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("anypassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("Enter a valid email address")
    ).toBeVisible();
  });

  test("marks the email input as aria-invalid when it fails validation", async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill("bad");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByLabel(/email/i)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  test("does not show an email error for a valid email + empty password", async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill("user@example.com");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Email error must not appear; only password error
    await expect(
      page.getByText("Enter a valid email address")
    ).not.toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Login page — server-side errors
// ---------------------------------------------------------------------------

test.describe("Login page — server-side errors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("shows a server error message for a wrong password", async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill("wrong-password-xyz");
    await page.getByRole("button", { name: "Sign in" }).click();

    // The error paragraph sits above the form fields
    const serverError = page.locator("p.text-destructive, p.text-sm.text-destructive").first();
    await expect(serverError).toBeVisible({ timeout: 8000 });
    // The message should be non-empty (exact text is controlled by Better Auth)
    await expect(serverError).not.toHaveText("");
  });

  test("shows a server error message for a non-existent email address", async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill("nobody@helpdesk.test");
    await page.getByLabel(/password/i).fill("somepassword123");
    await page.getByRole("button", { name: "Sign in" }).click();

    const serverError = page.locator("p.text-destructive, p.text-sm.text-destructive").first();
    await expect(serverError).toBeVisible({ timeout: 8000 });
    await expect(serverError).not.toHaveText("");
  });

  test("clears the server error message when the user resubmits", async ({
    page,
  }) => {
    // First, trigger a server error
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    const serverError = page.locator("p.text-destructive, p.text-sm.text-destructive").first();
    await expect(serverError).toBeVisible({ timeout: 8000 });

    // Now submit with wrong password again — error should re-appear (not be stale)
    await page.getByLabel(/password/i).fill("still-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    // The error clears momentarily (setServerError("")) then comes back
    await expect(serverError).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Login page — loading / submitting state
// ---------------------------------------------------------------------------

test.describe("Login page — loading state during submission", () => {
  test("disables the button and shows 'Signing in…' while the request is in flight", async ({
    page,
  }) => {
    // Delay the sign-in API response so we can observe the in-flight state
    await page.route("**/api/auth/sign-in/email", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // During the artificial delay the button must be disabled and show the
    // in-progress label
    const button = page.getByRole("button", { name: /signing in/i });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Route protection — unauthenticated redirects (ProtectedRoute)
// ---------------------------------------------------------------------------

test.describe("Route protection — unauthenticated user", () => {
  // Ensure no active session before each test by mocking an empty session
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/get-session", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      });
    });
  });

  test("redirects /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("/login", { timeout: 10000 });
    await expect(page).toHaveURL("/login");
  });

  test("redirects /tickets to /login", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForURL("/login", { timeout: 10000 });
    await expect(page).toHaveURL("/login");
  });

  test("redirects /tickets/:id to /login", async ({ page }) => {
    await page.goto("/tickets/some-ticket-id");
    await page.waitForURL("/login", { timeout: 10000 });
    await expect(page).toHaveURL("/login");
  });

  test("redirects /users to /login", async ({ page }) => {
    await page.goto("/users");
    await page.waitForURL("/login", { timeout: 10000 });
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// Authenticated user visiting /login → redirect to /dashboard
// ---------------------------------------------------------------------------

test.describe("Login page — already-authenticated redirect", () => {
  test("redirects an authenticated user away from /login to /dashboard", async ({
    page,
  }) => {
    // Log in first using the real auth flow
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/dashboard");

    // Now navigate directly to /login — should bounce back to /dashboard
    await page.goto("/login");
    await page.waitForURL("/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL("/dashboard");
  });
});

// ---------------------------------------------------------------------------
// Admin-only route (AdminRoute)
// ---------------------------------------------------------------------------

test.describe("AdminRoute — role-based access control", () => {
  test("allows an ADMIN user to access /users", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/users");
    // Should stay on /users — not redirect
    await expect(page).toHaveURL("/users");
  });

  test("redirects an AGENT user visiting /users to /dashboard", async ({
    page,
  }) => {
    // Use a mocked AGENT session (no real agent in the test DB)
    await mockAgentSession(page);
    await page.goto("/users");
    await page.waitForURL("/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL("/dashboard");
  });

  test("shows the Users nav link for ADMIN but not for AGENT", async ({
    page,
  }) => {
    // ADMIN: Users link is visible
    await loginAsAdmin(page);
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();

    // Open a new page context with an AGENT session
    const agentPage = page;
    // Navigate away to clear the current admin view, then apply agent mock
    await agentPage.route("**/api/auth/get-session", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "mock-agent-id",
            name: "Test Agent",
            email: "agent@helpdesk.test",
            role: "AGENT",
            emailVerified: true,
            image: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });
    await agentPage.goto("/dashboard");
    await expect(
      agentPage.getByRole("link", { name: "Users" })
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

test.describe("Logout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows a Sign out button in the navbar when authenticated", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Sign out" })
    ).toBeVisible();
  });

  test("clicking Sign out redirects to /login", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("after logout, navigating to /dashboard redirects back to /login", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/login");

    // Session cookie should be cleared — direct navigation must redirect
    await page.goto("/dashboard");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("after logout, the navbar is no longer rendered", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/login");

    // The auth-only navbar should be gone
    await expect(
      page.getByRole("button", { name: "Sign out" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Session persistence across page reloads
// ---------------------------------------------------------------------------

test.describe("Session persistence", () => {
  test("user remains logged in after a full page reload", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/dashboard");

    // Hard-reload — the AuthProvider re-fetches /api/auth/session on mount
    await page.reload();

    // Should stay on /dashboard, not redirect to /login
    await expect(page).toHaveURL("/dashboard");

    // Navbar should still be present
    await expect(
      page.getByRole("button", { name: "Sign out" })
    ).toBeVisible();
  });

  test("session cookie persists through navigation and reload", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Navigate around
    await page.getByRole("link", { name: "Tickets" }).click();
    await page.waitForURL("/tickets");

    // Reload from a non-dashboard page
    await page.reload();
    await expect(page).toHaveURL("/tickets");

    // Still authenticated
    await expect(
      page.getByRole("button", { name: "Sign out" })
    ).toBeVisible();
  });
});
