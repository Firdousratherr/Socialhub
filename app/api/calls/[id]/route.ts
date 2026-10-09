import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishUserEvent } from "@/lib/realtime";
import { platformEnabled } from "@/lib/platform-controls";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function getCallForUser(callId: string, userId: string) {
  return prisma.call.findFirst({
    where: {
      id: callId,
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
    include: {
      caller: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      callee: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });
}

function isStaleRinging(call: { status: string; createdAt: Date }) {
  return call.status === "RINGING" && Date.now() - call.createdAt.getTime() > 45_000;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const call = await getCallForUser(id, session.user.id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  if (isStaleRinging(call)) {
    const missed = await prisma.call.update({
      where: { id },
      data: { status: "MISSED", endedAt: new Date() },
      include: {
        caller: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
        callee: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      },
    });
    const otherUserId = session.user.id === missed.callerId ? missed.calleeId : missed.callerId;
    await publishUserEvent(otherUserId, {
      type: "call.updated",
      conversationId: missed.conversationId,
      entityId: missed.id,
      payload: { callId: missed.id, status: missed.status },
    });
    return NextResponse.json({ call: missed });
  }

  return NextResponse.json({ call });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const current = await getCallForUser(id, session.user.id);
  if (!current) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const body = await request.json().catch(() => null) as {
    action?: string;
  } | null;
  const action = body?.action;

  let nextStatus:
    | "ACTIVE"
    | "DECLINED"
    | "ENDED"
    | "CANCELLED"
    | "MISSED"
    | null = null;

  if (action === "accept") {
    const messagingEnabled = await platformEnabled("messaging", true);
    if (!messagingEnabled) {
      return NextResponse.json({ error: "Messaging and calls are temporarily disabled by the platform administrator." }, { status: 503 });
    }
    if (current.calleeId !== session.user.id || current.status !== "RINGING") {
      return NextResponse.json({ error: "This call cannot be accepted." }, { status: 409 });
    }
    nextStatus = "ACTIVE";
  } else if (action === "decline") {
    if (current.calleeId !== session.user.id || current.status !== "RINGING") {
      return NextResponse.json({ error: "This call cannot be declined." }, { status: 409 });
    }
    nextStatus = "DECLINED";
  } else if (action === "cancel") {
    if (current.callerId !== session.user.id || current.status !== "RINGING") {
      return NextResponse.json({ error: "This call cannot be cancelled." }, { status: 409 });
    }
    nextStatus = "CANCELLED";
  } else if (action === "end") {
    if (!["RINGING", "ACTIVE"].includes(current.status)) {
      return NextResponse.json({ error: "This call is already closed." }, { status: 409 });
    }
    nextStatus = "ENDED";
  } else {
    return NextResponse.json({ error: "Unknown call action." }, { status: 400 });
  }

  const call = await prisma.call.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(nextStatus === "ACTIVE" ? { acceptedAt: new Date() } : {}),
      ...(nextStatus !== "ACTIVE" ? { endedAt: new Date() } : {}),
    },
    include: {
      caller: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      callee: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });

  const otherUserId = session.user.id === call.callerId ? call.calleeId : call.callerId;
  await publishUserEvent(otherUserId, {
    type: "call.updated",
    conversationId: call.conversationId,
    entityId: call.id,
    payload: { callId: call.id, status: call.status, actorId: session.user.id },
  });

  return NextResponse.json({ call });
}
