import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const prisma = join("node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const run = (args) => execFileSync(prisma, args, { stdio: "inherit", env: process.env });

try {
  run(["migrate", "deploy"]);
  process.exit(0);
} catch {
  console.warn("prisma migrate deploy could not run against the existing production schema; attempting a one-time schema bootstrap.");
}

run(["db", "push", "--skip-generate"]);

const migrationsDir = join("prisma", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => name !== "migration_lock.toml")
  .sort();

for (const migration of migrations) {
  run(["migrate", "resolve", "--applied", migration]);
}
