import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const schema = z.object({ emoji: z.string().trim().min(1).max(16) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { messageId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true },
  });
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId: session.user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });

  const reaction = await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId, userId: session.user.id } },
    create: { messageId, userId: session.user.id, emoji: parsed.data.emoji },
    update: { emoji: parsed.data.emoji },
    include: { user: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json({ reaction });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { messageId } = await params;
  const message = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId: session.user.id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  await prisma.messageReaction.deleteMany({ where: { messageId, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
