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
    try {
      run(["migrate", "resolve", "--applied", migration]);
    } catch (error) {
      const output = errorOutput(error);
      if (!output.includes("P3008") && !/already recorded as applied/i.test(output)) {
        throw error;
      }
    }
  }
};

const synchronizeProductionSchema = () => {
  console.warn("Synchronizing the committed Prisma schema with the existing production database.");
  run(["db", "push"]);
  markAllMigrationsApplied();
};

try {
  // Production already contains the application schema and may have migration-history
  // failures from earlier deployments. Reconcile the actual schema first, then make
  // Prisma's migration ledger reflect that schema. This avoids retrying a known-bad
  // migration during a Vercel build.
  synchronizeProductionSchema();
  process.exit(0);
} catch (error) {
  throw new Error(
    `Prisma production schema synchronization failed.\n${errorOutput(error)}`,
    { cause: error },
  );
}
