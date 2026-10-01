import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { conversationInputSchema } from "@/lib/validation";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

const memberSelect = {
  userId: true,
  role: true,
  lastReadAt: true,
  user: { select: { id: true, name: true, username: true, image: true } },
} as const;

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { select: memberSelect },
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
            where: {
              conversationId: conversation.id,
              createdAt: { gt: member.lastReadAt },
              senderId: { not: session.user.id },
            },
          })
        : await prisma.message.count({
            where: {
              conversationId: conversation.id,
              senderId: { not: session.user.id },
            },
          });

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

  if (parsed.data.isGroup && memberIds.length < 2) {
    return NextResponse.json(
      { error: "Group conversations need at least two members." },
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
    const otherId = memberIds.find((id) => id !== session.user.id)!;
    const other = await prisma.user.findUnique({
      where: { id: otherId },
      select: { privacySetting: { select: { allowMessagesEveryone: true } } },
    });
    if (other?.privacySetting && !other.privacySetting.allowMessagesEveryone) {
      const friends = await prisma.friendRequest.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: session.user.id, receiverId: otherId },
            { senderId: otherId, receiverId: session.user.id },
          ],
        },
        select: { id: true },
      });
      if (!friends) return NextResponse.json({ error: "This user only accepts messages from friends." }, { status: 403 });
    }

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: otherId },
          { blockerId: otherId, blockedId: session.user.id },
        ],
      },
      select: { blockerId: true },
    });
    if (blocked) {
      return NextResponse.json({ error: "You cannot start a conversation while a block is active." }, { status: 403 });
    }

    const directKey = [...memberIds].sort().join(":");
    const existingByKey = await prisma.conversation.findUnique({
      where: { directKey },
      include: { members: { select: memberSelect } },
    });

    if (existingByKey && existingByKey.members.length === 2) {
      return NextResponse.json({ conversation: existingByKey, existing: true });
    }

    // Fallback for legacy direct conversations created before directKey existed.
    const existingLegacy = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        directKey: null,
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId: otherId } } },
          { members: { every: { userId: { in: memberIds } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: { members: { select: memberSelect } },
    });

    if (existingLegacy && existingLegacy.members.length === 2) {
      return NextResponse.json({ conversation: existingLegacy, existing: true });
    }
  }

  const directKey = parsed.data.isGroup ? null : [...memberIds].sort().join(":");

  try {
    const conversation = await prisma.conversation.create({
      data: {
        title: parsed.data.title ?? null,
        isGroup: parsed.data.isGroup,
        directKey,
        members: {
          create: memberIds.map((userId) => ({ userId })),
        },
      },
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

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (!parsed.data.isGroup && directKey) {
      const raced = await prisma.conversation.findUnique({
        where: { directKey },
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

      if (raced) {
        return NextResponse.json({ conversation: raced, existing: true });
      }
    }

    throw error;
  }
}
