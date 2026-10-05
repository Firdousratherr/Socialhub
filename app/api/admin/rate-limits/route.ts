import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

export async function GET(request: Request) {
  const access = await requireAdminPermission("RATE_LIMITS_VIEW");
  if (access.response) return access.response;
  const now = new Date();
  const [buckets, adminAttempts] = await Promise.all([
    prisma.rateLimitBucket.findMany({ where: { resetAt: { gt: now } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.adminLoginAttempt.findMany({ where: { resetAt: { gt: now } }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);
  await recordAdminEvent({ access, request, action: "VIEW_RATE_LIMITS", resource: "RATE_LIMIT" });
  return NextResponse.json({ buckets, adminAttempts });
}

export async function DELETE(request: Request) {
  const access = await requireAdminPermission("SECURITY_MANAGE");
  if (access.response) return access.response;
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim();
  if (!key) return NextResponse.json({ error: "Rate-limit key is required." }, { status: 400 });
  const deleted = await prisma.rateLimitBucket.deleteMany({ where: { key } });
  await recordAdminEvent({ access, request, action: "RESET_RATE_LIMIT", resource: "RATE_LIMIT", resourceId: key, riskLevel: "MEDIUM" });
  return NextResponse.json({ deleted: deleted.count });
}
