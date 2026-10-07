import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim();
  const after = parseDate(url.searchParams.get("after"));
  if (!conversationId) return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });

  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: session.user.id },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(after ? { createdAt: { gt: after } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    include: {
      sender: { select: { id: true, name: true, username: true, image: true } },
      attachments: true,
      reactions: true,
    },
  });

  return NextResponse.json({
    messages,
    nextAfter: messages.at(-1)?.createdAt.toISOString() ?? after?.toISOString() ?? null,
  });
}
