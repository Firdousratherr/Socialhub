import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageInputSchema } from "@/lib/validation";
import { canSendMessageInConversation } from "@/lib/conversation-access";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

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

  const before = new URL(request.url).searchParams.get("before");
  let cursor: { createdAt: Date; id: string } | null = null;
  if (before) {
    try {
      const decoded = JSON.parse(Buffer.from(before, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
      if (!decoded.createdAt || !decoded.id) throw new Error("invalid");
      const createdAt = new Date(decoded.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
      cursor = { createdAt, id: decoded.id };
    } catch {
      return NextResponse.json({ error: "Invalid message cursor." }, { status: 400 });
    }
  }

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    include: {
      sender: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      replyTo: { select: { id: true, content: true, senderId: true, sender: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } } } },
      attachments: { orderBy: { createdAt: "asc" } },
      reactions: { include: { user: { select: { id: true, name: true, image: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  const hasMore = rows.length > 50;
  const page = rows.slice(0, 50).reverse();
  const oldest = page[0];
  const nextBefore = hasMore && oldest ? Buffer.from(JSON.stringify({ createdAt: oldest.createdAt.toISOString(), id: oldest.id })).toString("base64url") : null;

  return NextResponse.json({ messages: page, nextBefore });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rl = await consumeRateLimit(rateLimitKey("messages", request, session.user.id), 60, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const messagingRestriction = await getActiveUserRestriction(session.user.id, "messagingRestrictedUntil");
  if (messagingRestriction) {
    return NextResponse.json({ error: "Messaging is temporarily restricted.", restrictedUntil: messagingRestriction.toISOString() }, { status: 403 });
  }
  const sendAccess = await canSendMessageInConversation(conversationId, session.user.id);
  if (!sendAccess.allowed) {
    return NextResponse.json({ error: sendAccess.reason ?? "Messaging is unavailable in this conversation." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = messageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 },
    );
  }

  let replyToId: string | null = null;
  if (typeof body?.replyToId === "string" && body.replyToId) {
    const parent = await prisma.message.findUnique({ where: { id: body.replyToId }, select: { id: true, conversationId: true, deletedAt: true } });
    if (!parent || parent.conversationId !== conversationId || parent.deletedAt) {
      return NextResponse.json({ error: "Reply target is unavailable." }, { status: 400 });
    }
    replyToId = parent.id;
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: parsed.data.content,
        replyToId,
        attachments: parsed.data.attachments.length ? {
          createMany: {
            data: parsed.data.attachments.map((url) => ({ url, senderId: session.user.id, kind: "image" })),
          },
        } : undefined,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
        replyTo: { select: { id: true, content: true, senderId: true, sender: { select: { id: true, name: true, username: true } } } },
        attachments: true,
        reactions: { include: { user: { select: { id: true, name: true, image: true } } } },
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return created;
  });

  return NextResponse.json({ message }, { status: 201 });
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!["read","archive","unarchive","mute","unmute"].includes(body?.action)) {
    return NextResponse.json({ error: "Unsupported conversation action." }, { status: 400 });
  }

  if (body.action === "read") {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    });
    return NextResponse.json({ read: true });
  }
  if (body.action === "archive" || body.action === "unarchive") {
    const member = await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: session.user.id } },
      data: { archivedAt: body.action === "archive" ? new Date() : null },
      select: { archivedAt: true },
    });
    return NextResponse.json({ archivedAt: member.archivedAt });
  }
  const member = await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { mutedUntil: body.action === "mute" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null },
    select: { mutedUntil: true },
  });
  return NextResponse.json({ mutedUntil: member.mutedUntil });
}
