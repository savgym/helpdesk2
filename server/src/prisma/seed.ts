import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });

  if (existing) {
    console.log("Admin already exists, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("REDACTED", 10);

  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Admin user created: admin@example.com / REDACTED");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
