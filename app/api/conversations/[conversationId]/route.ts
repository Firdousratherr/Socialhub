import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConversationAdmin } from "@/lib/conversation-access";
import * as z from "zod";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
});

const memberSchema = z.object({ userId: z.string().min(1) });

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { conversationId } = await params;
  const member = await getConversationAdmin(conversationId, session.user.id);
  if (!member) return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { conversationId } = await params;
  const access = await getConversationAdmin(conversationId, session.user.id);
  if (!access) return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  if (!access.conversation.isGroup || access.role !== "ADMIN") {
    return NextResponse.json({ error: "Only group administrators can rename this conversation." }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.title) return NextResponse.json({ error: "Provide a valid group title." }, { status: 400 });

  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title: parsed.data.title, updatedAt: new Date() },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          user: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
        },
      },
    },
  });

  return NextResponse.json({ conversation });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { conversationId } = await params;
  const access = await getConversationAdmin(conversationId, session.user.id);
  if (!access) return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  if (!access.conversation.isGroup || access.role !== "ADMIN") {
    return NextResponse.json({ error: "Only group administrators can add members." }, { status: 403 });
  }

  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === session.user.id) {
    return NextResponse.json({ error: "Provide a valid member." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, isActive: true },
  });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const existing = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: target.id } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "User is already a member." }, { status: 409 });

  const membership = await prisma.conversationMember.create({
    data: { conversationId, userId: target.id },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });

  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ membership }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : session.user.id;
  const access = await getConversationAdmin(conversationId, session.user.id);
  if (!access) return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });

  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, role: true, userId: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const isSelfLeave = userId === session.user.id;
  if (!isSelfLeave && (!access.conversation.isGroup || access.role !== "ADMIN")) {
    return NextResponse.json({ error: "Only group administrators can remove members." }, { status: 403 });
  }
  if (!isSelfLeave && target.role === "ADMIN") {
    return NextResponse.json({ error: "Remove administrator status before removing this member." }, { status: 409 });
  }

  const adminCount = await prisma.conversationMember.count({
    where: { conversationId, role: "ADMIN" },
  });
  if (isSelfLeave && target.role === "ADMIN" && adminCount <= 1) {
    const promoted = await prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: session.user.id } },
      orderBy: { joinedAt: "asc" },
      select: { userId: true },
    });
    if (promoted) {
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: promoted.userId } },
        data: { role: "ADMIN" },
      });
    }
  }

  await prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ success: true, leftUserId: userId });
}
