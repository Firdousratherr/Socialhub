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

try {
  run(["migrate", "deploy"]);
  process.exit(0);
} catch (error) {
  const output = errorOutput(error);

  if (output.includes("P3009")) {
    const failedMigration =
      listMigrations().find((migration) => output.includes(`migration `${migration}``) && /failed/i.test(output)) ??
      output.match(/The `([^`]+)` migration(?: started .*?)? failed/i)?.[1];

    if (!failedMigration) {
      throw new Error(
        `Prisma reported P3009 but the failed migration could not be identified. Raw output:\n${output}`,
        { cause: error },
      );
    }

    console.warn(`Recovering failed production migration ${failedMigration}.`);
    run(["migrate", "resolve", "--rolled-back", failedMigration]);

    try {
      run(["migrate", "deploy"]);
      process.exit(0);
    } catch (retryError) {
      const retryOutput = errorOutput(retryError);
      if (retryOutput.includes("P3005") || retryOutput.includes("database schema is not empty")) {
        bootstrapExistingSchema();
        process.exit(0);
      }
      if (retryOutput.includes("P3009")) {
        console.warn(`Migration ${failedMigration} still cannot be replayed; reconciling the live schema instead.`);
        run(["db", "push"]);
        markMigrationsAppliedFrom(failedMigration);
        process.exit(0);
      }
      throw retryError;
    }
  }

  if (output.includes("P3005") || output.includes("database schema is not empty")) {
    bootstrapExistingSchema();
    process.exit(0);
  }

  throw error;
}
