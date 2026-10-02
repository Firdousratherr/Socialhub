import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: Request) {
  const authResult = await requireAdminPermission("MESSAGES_VIEW");
  if (authResult.response) return authResult.response;

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
    });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { sender: { select: { id: true, name: true, username: true, image: true } } },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: authResult.user.id,
        action: "VIEW_CONVERSATION",
        targetType: "CONVERSATION",
        targetId: conversationId,
        details: JSON.stringify({ messageCount: messages.length }),
      },
    });

    return NextResponse.json({ conversation, messages });
  }

  const conversations = await prisma.conversation.findMany({
    where: q
      ? {
          members: {
            some: {
              user: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, senderId: true },
      },
    },
  });

  return NextResponse.json({ conversations });
}
