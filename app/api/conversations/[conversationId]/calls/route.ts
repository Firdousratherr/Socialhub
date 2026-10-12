import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canStartConversationWith } from "@/lib/conversation-access";
import { publishUserEvent } from "@/lib/realtime";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { platformEnabled } from "@/lib/platform-controls";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const messagingEnabled = await platformEnabled("messaging", true);
  if (!messagingEnabled) return NextResponse.json({ error: "Messaging and calls are temporarily disabled by the platform administrator." }, { status: 503 });

  const { conversationId } = await params;
  const rl = await consumeRateLimit(rateLimitKey("call-start", request, session.user.id), 12, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
        },
      },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (conversation.isGroup || conversation.members.length !== 2) {
    return NextResponse.json({ error: "Calling is currently available for one-to-one conversations only." }, { status: 400 });
  }
  if (!conversation.members.some((member) => member.userId === session.user.id)) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const callee = conversation.members.find((member) => member.userId !== session.user.id);
  if (!callee) return NextResponse.json({ error: "Conversation members are invalid." }, { status: 400 });

  const access = await canStartConversationWith(session.user.id, callee.userId);
  if (!access.allowed) return NextResponse.json({ error: access.reason ?? "Calling is not allowed." }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    type?: string;
  } | null;
  const type = body?.type === "VIDEO" ? "VIDEO" : body?.type === "AUDIO" ? "AUDIO" : null;
  if (!type) return NextResponse.json({ error: "Call type must be AUDIO or VIDEO." }, { status: 400 });

  const active = await prisma.call.findFirst({
    where: {
      conversationId,
      status: { in: ["RINGING", "ACTIVE"] },
    },
    select: { id: true, status: true },
  });
  if (active) return NextResponse.json({ error: "A call is already active for this conversation.", call: active }, { status: 409 });

  const call = await prisma.call.create({
    data: {
      conversationId,
      callerId: session.user.id,
      calleeId: callee.userId,
      type,
      status: "RINGING",
    },
    include: {
      caller: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      callee: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });

  await publishUserEvent(callee.userId, {
    type: "call.incoming",
    conversationId,
    entityId: call.id,
    payload: {
      callId: call.id,
      callType: call.type,
      caller: call.caller,
      expiresInSeconds: 45,
    },
  });

  return NextResponse.json({ call }, { status: 201 });
}
