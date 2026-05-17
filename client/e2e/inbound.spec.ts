import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Inbound email webhook — POST /api/inbound/email
//
// These are API-level tests that use Playwright's `request` fixture directly.
// No browser UI is involved — we call the endpoint through the Vite dev-server
// proxy (baseURL: http://localhost:5174 → proxied to http://localhost:3001).
//
// Webhook secret auth tests are grouped in their own describe block and are
// skipped unless WEBHOOK_SECRET is set in server/.env.test. To enable them,
// add the following line to server/.env.test and restart the test server:
//
//   WEBHOOK_SECRET=test-webhook-secret-123
//
// ---------------------------------------------------------------------------

const ENDPOINT = "/api/inbound/email";

// A valid payload that satisfies every field in the emailSchema.
const VALID_PAYLOAD = {
  from: "Customer@Example.COM",
  fromName: "Alice Customer",
  subject: "My order hasn't arrived",
  body: "I placed order #12345 three weeks ago and haven't heard back.",
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test.describe("Inbound email webhook — happy path", () => {
  test("returns 201 with the created ticket when all fields are valid", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, { data: VALID_PAYLOAD });

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // id must be a number (Prisma auto-increment integer)
    expect(typeof ticket.id).toBe("number");

    // subject echoes back unchanged
    expect(ticket.subject).toBe(VALID_PAYLOAD.subject);

    // senderEmail is lowercased regardless of input casing
    expect(ticket.senderEmail).toBe(VALID_PAYLOAD.from.toLowerCase());

    // senderName echoes back unchanged
    expect(ticket.senderName).toBe(VALID_PAYLOAD.fromName);

    // createdAt must be an ISO-8601 date string
    expect(typeof ticket.createdAt).toBe("string");
    expect(new Date(ticket.createdAt).getTime()).not.toBeNaN();
  });

  test("lowercases the sender email regardless of input casing", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, from: "UPPER@EXAMPLE.COM" },
    });

    expect(response.status()).toBe(201);
    const ticket = await response.json();
    expect(ticket.senderEmail).toBe("upper@example.com");
  });

  test("response body contains exactly the expected keys", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, { data: VALID_PAYLOAD });

    expect(response.status()).toBe(201);
    const ticket = await response.json();

    const keys = Object.keys(ticket).sort();
    expect(keys).toEqual(
      ["createdAt", "id", "senderEmail", "senderName", "subject"].sort()
    );
  });

  test("creates a unique ticket for each request (distinct ids)", async ({
    request,
  }) => {
    const [r1, r2] = await Promise.all([
      request.post(ENDPOINT, { data: VALID_PAYLOAD }),
      request.post(ENDPOINT, { data: VALID_PAYLOAD }),
    ]);

    expect(r1.status()).toBe(201);
    expect(r2.status()).toBe(201);

    const t1 = await r1.json();
    const t2 = await r2.json();
    expect(t1.id).not.toBe(t2.id);
  });
});

// ---------------------------------------------------------------------------
// Validation — missing required fields
// ---------------------------------------------------------------------------

test.describe("Inbound email webhook — validation errors", () => {
  test("returns 400 with the correct error when 'fromName' is missing", async ({
    request,
  }) => {
    const { fromName: _omitted, ...payload } = VALID_PAYLOAD;
    const response = await request.post(ENDPOINT, { data: payload });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Sender name is required");
  });

  test("returns 400 with the correct error when 'subject' is missing", async ({
    request,
  }) => {
    const { subject: _omitted, ...payload } = VALID_PAYLOAD;
    const response = await request.post(ENDPOINT, { data: payload });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Subject is required");
  });

  test("returns 400 with the correct error when 'body' is missing", async ({
    request,
  }) => {
    const { body: _omitted, ...payload } = VALID_PAYLOAD;
    const response = await request.post(ENDPOINT, { data: payload });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Body is required");
  });

  test("returns 400 with the correct error when 'from' is missing", async ({
    request,
  }) => {
    const { from: _omitted, ...payload } = VALID_PAYLOAD;
    const response = await request.post(ENDPOINT, { data: payload });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("A valid sender email is required");
  });

  test("returns 400 with the correct error when 'from' is not a valid email", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, from: "not-an-email" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("A valid sender email is required");
  });

  test("returns 400 when 'fromName' is an empty string", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, fromName: "" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Sender name is required");
  });

  test("returns 400 when 'fromName' is whitespace-only (trim().min(1) check)", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, fromName: "   " },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Sender name is required");
  });

  test("returns 400 when 'subject' is whitespace-only", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, subject: "   " },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Subject is required");
  });

  test("returns 400 when 'body' is whitespace-only", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, body: "   " },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Body is required");
  });

  test("returns 400 when the request body is completely empty", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, { data: {} });

    expect(response.status()).toBe(400);
    const body = await response.json();
    // The first Zod issue will be one of the required-field errors
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Webhook secret authentication
//
// These tests are skipped unless WEBHOOK_SECRET is present in the server
// environment. To enable them, add the following line to server/.env.test
// and restart the test runner:
//
//   WEBHOOK_SECRET=test-webhook-secret-123
//
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

test.describe("Inbound email webhook — secret authentication", () => {
  test.skip(
    !WEBHOOK_SECRET,
    "Skipped: WEBHOOK_SECRET is not set in the test environment. " +
      "Add WEBHOOK_SECRET=test-webhook-secret-123 to server/.env.test to enable."
  );

  test("returns 401 when the Authorization header is absent", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, { data: VALID_PAYLOAD });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 401 when the Authorization header uses the wrong secret", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: VALID_PAYLOAD,
      headers: { Authorization: "Bearer wrong-secret" },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 401 when the token is present but not prefixed with 'Bearer '", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: VALID_PAYLOAD,
      headers: { Authorization: WEBHOOK_SECRET! },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 201 when the correct Bearer token is provided", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: VALID_PAYLOAD,
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
    });

    expect(response.status()).toBe(201);
    const ticket = await response.json();
    expect(typeof ticket.id).toBe("number");
    expect(ticket.senderEmail).toBe(VALID_PAYLOAD.from.toLowerCase());
  });

  test("still validates the payload even when the correct token is supplied", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_PAYLOAD, from: "not-an-email" },
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("A valid sender email is required");
  });
});
