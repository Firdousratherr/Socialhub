import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

const PRESENCE_TTL_MS = 70_000;

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rawIds = new URL(request.url).searchParams.get("userIds") ?? session.user.id;
  const userIds = Array.from(new Set(
    rawIds.split(",").map((id) => id.trim()).filter(Boolean),
  )).slice(0, 50);

  const rows = await prisma.presence.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      state: true,
      lastSeenAt: true,
      expiresAt: true,
      user: { select: { privacySetting: { select: { showActiveStatus: true } } } },
    },
  });

  const now = new Date();
  const byId = new Map(rows.map((row) => [
    row.userId,
    {
      state: row.userId === session.user.id || row.user.privacySetting?.showActiveStatus !== false
        ? (row.expiresAt && row.expiresAt > now ? row.state : "OFFLINE")
        : "OFFLINE",
      lastSeenAt: row.userId === session.user.id || row.user.privacySetting?.showActiveStatus !== false ? row.lastSeenAt : null,
      expiresAt: row.userId === session.user.id || row.user.privacySetting?.showActiveStatus !== false ? row.expiresAt : null,
    },
  ]));

  return NextResponse.json({
    presence: userIds.map((userId) => ({
      userId,
      ...(byId.get(userId) ?? { state: "OFFLINE", lastSeenAt: null, expiresAt: null }),
    })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rl = await consumeRateLimit(rateLimitKey("presence", request, session.user.id), 12, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PRESENCE_TTL_MS);

  const presence = await prisma.presence.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      state: "ONLINE",
      lastSeenAt: now,
      expiresAt,
    },
    update: {
      state: "ONLINE",
      lastSeenAt: now,
      expiresAt,
    },
    select: { userId: true, state: true, lastSeenAt: true, expiresAt: true },
  });

  return NextResponse.json({ presence });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  await prisma.presence.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, state: "OFFLINE", lastSeenAt: new Date(), expiresAt: null },
    update: { state: "OFFLINE", lastSeenAt: new Date(), expiresAt: null },
  });

  return NextResponse.json({ offline: true });
}
