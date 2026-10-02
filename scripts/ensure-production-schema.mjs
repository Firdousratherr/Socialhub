import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const prisma = join("node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");

const run = (args) => {
  try {
    const output = execFileSync(prisma, args, {
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (output) process.stdout.write(output);
    return output;
  } catch (error) {
    if (error.stdout) process.stdout.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    throw error;
  }
};

const errorOutput = (error) => `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;

const listMigrations = () =>
  readdirSync(join("prisma", "migrations"))
    .filter((name) => name !== "migration_lock.toml")
    .sort();

const markAllMigrationsApplied = () => {
  for (const migration of listMigrations()) {
    run(["migrate", "resolve", "--applied", migration]);
  }
};

const bootstrapSchema = (reason) => {
  console.warn(`Synchronizing the committed Prisma schema with the existing production database: ${reason}`);
  // Prisma 7 removed the --skip-generate option from db push.
  run(["db", "push"]);
  markAllMigrationsApplied();
};

try {
  run(["migrate", "deploy"]);
  process.exit(0);
} catch (error) {
  const output = errorOutput(error);

  // P3009 means the migration history contains a failed migration. Retrying
  // the same SQL can fail again when that migration was partially applied.
  // Reconcile the actual database schema with the committed Prisma schema
  // instead, then mark the committed migration set as applied.
  if (output.includes("P3009")) {
    bootstrapSchema("Prisma reported a previously failed production migration (P3009).");
    process.exit(0);
  }

  // P3005 means the existing database schema predates Prisma Migrate history.
  if (output.includes("P3005") || output.includes("database schema is not empty")) {
    bootstrapSchema("the existing database schema is not migration-managed (P3005).");
    process.exit(0);
  }

  throw error;
}
