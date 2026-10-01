import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageInputSchema } from "@/lib/validation";

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
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      sender: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isMember(conversationId, session.user.id))) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }

  const parsed = messageInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 },
    );
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: parsed.data.content,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, image: true } },
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
  if (body?.action !== "read") {
    return NextResponse.json({ error: "Unsupported conversation action." }, { status: 400 });
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ read: true });
}
