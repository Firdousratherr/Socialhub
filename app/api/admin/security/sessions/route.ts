import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

export async function GET(request: Request) {
  const access = await requireAdminPermission("SECURITY_MANAGE");
  if (access.response) return access.response;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || undefined;

  const sessions = await prisma.session.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
      user: { select: { id: true, name: true, username: true, email: true, role: true, isActive: true } },
    },
  });

  await recordAdminEvent({ access, request, action: "VIEW_SECURITY_SESSIONS", resource: "SESSION" });
  return NextResponse.json({ sessions });
}

export async function DELETE(request: Request) {
  const access = await requireAdminPermission("SECURITY_MANAGE");
  if (access.response) return access.response;

  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) return NextResponse.json({ error: "Session ID is required." }, { status: 400 });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, user: { select: { name: true, username: true } } },
  });
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (session.userId === access.user.id) {
    return NextResponse.json({ error: "Use your own Security screen to manage your current account sessions." }, { status: 400 });
  }

  await prisma.session.delete({ where: { id: sessionId } });
  await recordAdminEvent({
    access,
    request,
    action: "REVOKE_USER_SESSION",
    resource: "SESSION",
    resourceId: sessionId,
    reason: "Owner/admin revoked a user session from the Device & Security Center.",
    after: { userId: session.userId },
  });

  return NextResponse.json({ revoked: true, userId: session.userId });
}
