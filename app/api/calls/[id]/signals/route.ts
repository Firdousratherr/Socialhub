import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishUserEvent } from "@/lib/realtime";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { platformEnabled } from "@/lib/platform-controls";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function getCall(callId: string, userId: string) {
  return prisma.call.findFirst({
    where: {
      id: callId,
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
    select: {
      id: true,
      callerId: true,
      calleeId: true,
      conversationId: true,
      status: true,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const messagingEnabled = await platformEnabled("messaging", true);
  if (!messagingEnabled) return NextResponse.json({ error: "Messaging and calls are temporarily disabled by the platform administrator." }, { status: 503 });
  const { id } = await params;
  const call = await getCall(id, session.user.id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const after = new URL(request.url).searchParams.get("after");
  const rows = await prisma.callSignal.findMany({
    where: {
      callId: id,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      senderId: { not: session.user.id },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
  });

  return NextResponse.json({
    signals: rows.map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      payload: JSON.parse(signal.payload),
      createdAt: signal.createdAt,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const messagingEnabled = await platformEnabled("messaging", true);
  if (!messagingEnabled) return NextResponse.json({ error: "Messaging and calls are temporarily disabled by the platform administrator." }, { status: 503 });
  const { id } = await params;

  const rl = await consumeRateLimit(rateLimitKey("call-signal", request, session.user.id), 240, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const call = await getCall(id, session.user.id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!["RINGING", "ACTIVE"].includes(call.status)) {
    return NextResponse.json({ error: "Call is no longer active." }, { status: 409 });
  }

  const body = await request.json().catch(() => null) as {
    kind?: string;
    payload?: unknown;
  } | null;
  if (!body?.payload || !["OFFER", "ANSWER", "CANDIDATE"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid call signal." }, { status: 400 });
  }
  if (body.kind === "OFFER" && call.callerId !== session.user.id) {
    return NextResponse.json({ error: "Only the caller can send an offer." }, { status: 403 });
  }
  if (body.kind === "ANSWER" && call.calleeId !== session.user.id) {
    return NextResponse.json({ error: "Only the callee can send an answer." }, { status: 403 });
  }

  const signal = await prisma.callSignal.create({
    data: {
      callId: id,
      senderId: session.user.id,
      kind: body.kind as "OFFER" | "ANSWER" | "CANDIDATE",
      payload: JSON.stringify(body.payload),
    },
  });

  const otherUserId = session.user.id === call.callerId ? call.calleeId : call.callerId;
  await publishUserEvent(otherUserId, {
    type: "call.signal",
    conversationId: call.conversationId,
    entityId: call.id,
    payload: { callId: call.id, signalId: signal.id, kind: signal.kind },
  });

  return NextResponse.json({ signal: { id: signal.id, kind: signal.kind, createdAt: signal.createdAt } }, { status: 201 });
}
