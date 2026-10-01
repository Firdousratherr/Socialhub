import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { conversationInputSchema } from "@/lib/validation";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, senderId: true, content: true, createdAt: true },
      },
    },
  });

  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conversation) => {
      const member = conversation.members.find((item) => item.userId === session.user.id);
      const unreadCount = member?.lastReadAt
        ? await prisma.message.count({
            where: { conversationId: conversation.id, createdAt: { gt: member.lastReadAt } },
          })
        : await prisma.message.count({ where: { conversationId: conversation.id } });

      return {
        ...conversation,
        unreadCount,
      };
    }),
  );

  return NextResponse.json({ conversations: conversationsWithUnread });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = conversationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid conversation." },
      { status: 400 },
    );
  }

  const memberIds = Array.from(new Set([session.user.id, ...parsed.data.memberIds]));
  if (!parsed.data.isGroup && memberIds.length !== 2) {
    return NextResponse.json(
      { error: "One-to-one conversations need exactly one other member." },
      { status: 400 },
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: memberIds }, isActive: true },
    select: { id: true },
  });

  if (users.length !== memberIds.length) {
    return NextResponse.json({ error: "One or more members do not exist." }, { status: 400 });
  }

  if (!parsed.data.isGroup && memberIds.length === 2) {
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: memberIds.find((id) => id !== session.user.id)! },
          { blockerId: memberIds.find((id) => id !== session.user.id)!, blockedId: session.user.id },
        ],
      },
      select: { blockerId: true },
    });
    if (blocked) {
      return NextResponse.json({ error: "You cannot start a conversation while a block is active." }, { status: 403 });
    }

    const otherId = memberIds.find((id) => id !== session.user.id)!;
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId: otherId } } },
          { members: { every: { userId: { in: memberIds } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
    });
    if (existing && existing.members.length === 2) {
      return NextResponse.json({ conversation: existing, existing: true });
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      title: parsed.data.title ?? null,
      isGroup: parsed.data.isGroup,
      members: {
        create: memberIds.map((userId) => ({ userId })),
      },
    },
    include: {
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
    },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
