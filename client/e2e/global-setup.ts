import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function loadEnvFile(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    vars[key] = value;
  }
  return vars;
}

export default async function globalSetup() {
  const serverDir = path.resolve(__dirname, "../../server");
  const testEnv = loadEnvFile(path.join(serverDir, ".env.test"));
  const dbUrl = testEnv.DATABASE_URL;

  if (!dbUrl) throw new Error("DATABASE_URL not found in server/.env.test");

  // Create test database if it doesn't exist
  try {
    execSync(
      `docker exec helpdesk-postgres-1 psql -U helpdesk -c "CREATE DATABASE helpdesk_test WITH OWNER helpdesk;"`,
      { stdio: "pipe" }
    );
    console.log("[setup] Created helpdesk_test database");
  } catch {
    // Already exists
  }

  // Apply migrations to the test database
  execSync("bunx prisma migrate deploy", {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "inherit",
  });

  // Seed the test database with the admin user
  execSync("bun src/prisma/seed.ts", {
    cwd: serverDir,
    env: { ...process.env, ...testEnv },
    stdio: "inherit",
  });
}
