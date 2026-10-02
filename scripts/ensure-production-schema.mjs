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

const failedMigrationFrom = (output) =>
  listMigrations().find(
    (migration) => output.includes("migration `" + migration + "`") && /failed/i.test(output),
  ) ?? output.match(/The `([^`]+)` migration(?: started .*?)? failed/i)?.[1];

const markMigrationsAppliedFrom = (migrationName) => {
  for (const migration of listMigrations().filter((name) => name >= migrationName)) {
    run(["migrate", "resolve", "--applied", migration]);
  }
};

const bootstrapExistingSchema = () => {
  console.warn("Synchronizing the committed Prisma schema with the existing production database.");
  run(["db", "push"]);
  for (const migration of listMigrations()) {
    run(["migrate", "resolve", "--applied", migration]);
  }
};

const recoverMigrationFailure = (output) => {
  const failedMigration = failedMigrationFrom(output);
  if (failedMigration) {
    console.warn(`Recovering failed production migration ${failedMigration}.`);
    run(["migrate", "resolve", "--rolled-back", failedMigration]);
  } else {
    console.warn("Prisma reported a failed migration but did not expose its migration name; reconciling the committed schema.");
  }

  bootstrapExistingSchema();
};

try {
  run(["migrate", "deploy"]);
  process.exit(0);
} catch (error) {
  const output = errorOutput(error);

  if (output.includes("P3009") || output.includes("P3018")) {
    try {
      recoverMigrationFailure(output);
      process.exit(0);
    } catch (recoveryError) {
      throw new Error(
        `Prisma migration recovery failed. Raw migration output:\n${output}\nRecovery output:\n${errorOutput(recoveryError)}`,
        { cause: recoveryError },
      );
    }
  }

  if (output.includes("P3005") || output.includes("database schema is not empty")) {
    try {
      bootstrapExistingSchema();
      process.exit(0);
    } catch (recoveryError) {
      throw new Error(
        `Prisma production schema bootstrap failed. Raw migration output:\n${output}\nBootstrap output:\n${errorOutput(recoveryError)}`,
        { cause: recoveryError },
      );
    }
  }

  throw error;
}
