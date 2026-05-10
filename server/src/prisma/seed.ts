import { auth } from "../lib/auth";

async function main() {
  const existing = await auth.api
    .signInEmail({ body: { email: "admin@example.com", password: "REDACTED" } })
    .catch(() => null);

  if (existing) {
    console.log("Admin already exists, skipping seed.");
    return;
  }

  await auth.api.signUpEmail({
    body: {
      name: "Admin",
      email: "admin@example.com",
      password: "REDACTED",
    },
  });

  console.log("Admin user created: admin@example.com / REDACTED");
}

main().catch(console.error);
