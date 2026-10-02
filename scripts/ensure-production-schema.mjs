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

const bootstrapSchema = () => {
  console.warn("Synchronizing the committed Prisma schema with the existing production database.");
  // Prisma 7 no longer accepts --skip-generate for db push.
  run(["db", "push"]);

  const migrationsDir = join("prisma", "migrations");
  const migrations = readdirSync(migrationsDir)
    .filter((name) => name !== "migration_lock.toml")
    .sort();

  for (const migration of migrations) {
    run(["migrate", "resolve", "--applied", migration]);
  }
};

try {
  run(["migrate", "deploy"]);
  process.exit(0);
} catch (error) {
  const output = errorOutput(error);

  if (output.includes("P3009")) {
    const failedMigration = output.match(/The \`([^\`]+)\` migration started .* failed/)?.[1];

    if (!failedMigration) {
      throw error;
    }

    console.warn(`Found failed production migration ${failedMigration}; marking it rolled back and retrying migration deployment.`);
    run(["migrate", "resolve", "--rolled-back", failedMigration]);

    try {
      run(["migrate", "deploy"]);
      process.exit(0);
    } catch (retryError) {
      const retryOutput = errorOutput(retryError);
      if (!retryOutput.includes("P3005") && !retryOutput.includes("P3009")) {
        throw retryError;
      }
      bootstrapSchema();
      process.exit(0);
    }
  }

  if (output.includes("P3005") || output.includes("database schema is not empty")) {
    console.warn("The existing production schema is not migration-managed; performing a one-time schema bootstrap.");
    bootstrapSchema();
    process.exit(0);
  }

  throw error;
}
