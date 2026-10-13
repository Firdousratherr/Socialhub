import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

function normalizeDatabaseSslMode(value: string): string {
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    // pg-connection-string currently aliases these values to verify-full and
    // emits a warning on every cold start. Make that effective mode explicit.
    if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    // Leave non-URL or malformed values untouched so normal connection errors
    // remain visible rather than being hidden by configuration normalization.
  }
  return value;
}

const databaseUrl = normalizeDatabaseSslMode(
  process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/socialhub",
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
