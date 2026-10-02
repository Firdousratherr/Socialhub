import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

const TYPING_TTL_MS = 5_000;

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function isMember(conversationId: string, userId: string) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const now = new Date();
  const rows = await prisma.rateLimitBucket.findMany({
    where: {
      key: { startsWith: "typing:" + conversationId + ":" },
      resetAt: { gt: now },
    },
    select: { key: true, resetAt: true },
  });

  const userIds = rows
    .map((row) => row.key.split(":").at(-1))
    .filter((id): id is string => Boolean(id) && id !== session.user.id);

  if (!userIds.length) return NextResponse.json({ typing: [] });

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true, deletedAt: null },
    select: { id: true, name: true, image: true, username: true },
  });

  return NextResponse.json({
    typing: users.map((user) => ({ ...user, expiresAt: rows.find((row) => row.key.endsWith(":" + user.id))?.resetAt ?? now })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rl = await consumeRateLimit(rateLimitKey("typing", request, session.user.id), 90, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const resetAt = new Date(Date.now() + TYPING_TTL_MS);
  await prisma.rateLimitBucket.upsert({
    where: { key: "typing:" + conversationId + ":" + session.user.id },
    update: { count: 1, resetAt },
    create: { key: "typing:" + conversationId + ":" + session.user.id, count: 1, resetAt },
  });

  return NextResponse.json({ typing: true, expiresAt: resetAt });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  await prisma.rateLimitBucket.deleteMany({
    where: { key: "typing:" + conversationId + ":" + session.user.id },
  });
  return NextResponse.json({ typing: false });
}
