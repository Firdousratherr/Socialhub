import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCallToken, liveKitConfigured } from "@/lib/livekit";

async function session() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const current = await session();
  if (!current?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!liveKitConfigured()) return NextResponse.json({ error: "Calling is not configured on this server yet." }, { status: 503 });

  const { callId } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!["accept", "connect", "end", "decline", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Unsupported call action." }, { status: 400 });
  }

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call || (call.callerId !== current.user.id && call.calleeId !== current.user.id)) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  const statusByAction = {
    accept: "ACCEPTED",
    connect: "CONNECTED",
    end: "ENDED",
    decline: "DECLINED",
    cancel: "CANCELLED",
  } as const;

  const status = statusByAction[action as keyof typeof statusByAction];
  const updated = await prisma.call.update({
    where: { id: callId },
    data: {
      status,
      ...(status === "CONNECTED" ? { startedAt: call.startedAt ?? new Date() } : {}),
      ...(["ENDED", "DECLINED", "CANCELLED"].includes(status) ? { endedAt: new Date() } : {}),
    },
  });

  if (action === "accept" || action === "connect") {
    const token = await createCallToken({ identity: current.user.id, name: current.user.name, roomName: call.roomName, isVideo: call.isVideo });
    return NextResponse.json({ call: updated, token, serverUrl: process.env.LIVEKIT_URL });
  }

  return NextResponse.json({ call: updated });
}
