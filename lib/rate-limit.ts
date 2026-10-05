import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("Invalid rate limit configuration.");
  }

  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("id", "key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${key}, 1, ${resetAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;

  const bucket = rows[0];
  if (!bucket) throw new Error("Rate-limit bucket could not be updated.");

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter,
  };
}

export async function consumeMutationRateLimit(
  prefix: string,
  request: Request,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  return consumeRateLimit(rateLimitKey(prefix, request, subject), limit, windowSeconds);
}

export function rateLimitKey(prefix: string, request: Request, subject?: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return [prefix, subject || ip].join(":");
}

export function rateLimitResponse(retryAfter: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}
