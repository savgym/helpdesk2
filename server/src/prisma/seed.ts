import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";

// Separate instance without disableSignUp so the seed can always create users.
const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    await seedAuth.api.signUpEmail({
      body: { name: "Admin", email, password },
    });

    await prisma.user.update({
      where: { email },
      data: { role: Role.ADMIN },
    });

    console.log(`Admin user created: ${email} (role: ${Role.ADMIN})`);
  } else {
    console.log(`Admin already exists (${email}), skipping.`);
  }

  await prisma.user.upsert({
    where: { email: "ai@helpdesk.internal" },
    update: {},
    create: {
      id: "ai-agent",
      name: "AI",
      email: "ai@helpdesk.internal",
      emailVerified: true,
      role: Role.AGENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log("AI agent user ensured.");
}

main().catch(console.error);
