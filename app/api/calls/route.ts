import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCallToken, liveKitConfigured } from "@/lib/livekit";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

async function session() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(request: Request) {
  const current = await session();
  if (!current?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!liveKitConfigured()) return NextResponse.json({ error: "Calling is not configured on this server yet." }, { status: 503 });

  const rl = await consumeRateLimit(rateLimitKey("calls", request, current.user.id), 10, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const body = await request.json().catch(() => null);
  const calleeId = typeof body?.calleeId === "string" ? body.calleeId.trim() : "";
  const isVideo = Boolean(body?.isVideo);
  if (!calleeId || calleeId === current.user.id) return NextResponse.json({ error: "Choose another user to call." }, { status: 400 });

  const callee = await prisma.user.findUnique({ where: { id: calleeId }, select: { id: true, name: true, isActive: true, deletedAt: true } });
  if (!callee || !callee.isActive || callee.deletedAt) return NextResponse.json({ error: "That account is unavailable." }, { status: 404 });

  const blocked = await prisma.block.findFirst({
    where: { OR: [{ blockerId: current.user.id, blockedId: calleeId }, { blockerId: calleeId, blockedId: current.user.id }] },
    select: { blockerId: true },
  });
  if (blocked) return NextResponse.json({ error: "Calls are unavailable between these accounts." }, { status: 403 });

  const roomName = "call_" + crypto.randomUUID();
  const call = await prisma.call.create({
    data: { callerId: current.user.id, calleeId, roomName, isVideo },
    include: {
      caller: { select: { id: true, name: true, image: true } },
      callee: { select: { id: true, name: true, image: true } },
    },
  });
  const token = await createCallToken({ identity: current.user.id, name: current.user.name, roomName, isVideo });
  return NextResponse.json({ call, token, serverUrl: process.env.LIVEKIT_URL }, { status: 201 });
}

export async function GET() {
  const current = await session();
  if (!current?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const calls = await prisma.call.findMany({
    where: { OR: [{ callerId: current.user.id }, { calleeId: current.user.id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      caller: { select: { id: true, name: true, image: true, username: true } },
      callee: { select: { id: true, name: true, image: true, username: true } },
    },
  });
  return NextResponse.json({ calls });
}
