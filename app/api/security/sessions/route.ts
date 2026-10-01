import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const current = await getSession();
  if (!current?.user || !current.session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const sessions = await prisma.session.findMany({
    where: { userId: current.user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      ...session,
      isCurrent: session.id === current.session.id,
    })),
  });
}

export async function DELETE(request: Request) {
  const current = await getSession();
  if (!current?.user || !current.session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.allOther === true) {
    const result = await prisma.session.deleteMany({
      where: { userId: current.user.id, id: { not: current.session.id } },
    });
    return NextResponse.json({ revoked: result.count });
  }

  if (typeof body?.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ error: "A session ID is required." }, { status: 400 });
  }

  if (body.sessionId === current.session.id) {
    return NextResponse.json({ error: "Use sign out to end the current session." }, { status: 400 });
  }

  const result = await prisma.session.deleteMany({
    where: { id: body.sessionId, userId: current.user.id },
  });

  if (!result.count) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
