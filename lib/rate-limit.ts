import { prisma } from "@/lib/prisma";

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const existing = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!existing || existing.resetAt.getTime() <= now) {
    const resetAt = new Date(now + windowSeconds * 1000);
    const bucket = existing
      ? await prisma.rateLimitBucket.update({ where: { key }, data: { count: 1, resetAt } })
      : await prisma.rateLimitBucket.create({ data: { key, count: 1, resetAt } });
    return { allowed: true, remaining: Math.max(0, limit - bucket.count), retryAfter: windowSeconds };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt.getTime() - now) / 1000)),
    };
  }

  const bucket = await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((existing.resetAt.getTime() - now) / 1000)),
  };
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
