import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationUpdateSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });

  const enabledTypes = [
    preferences.likes ? "LIKE" : null,
    preferences.comments ? "COMMENT" : null,
    preferences.follows ? "FOLLOW" : null,
    preferences.friendRequests ? "FRIEND_REQUEST" : null,
    preferences.friendAccepted ? "FRIEND_ACCEPTED" : null,
    preferences.messages ? "MESSAGE" : null,
    preferences.mentions ? "MENTION" : null,
    preferences.shares ? "SHARE" : null,
    preferences.system ? "SYSTEM" : null,
  ].filter(Boolean) as Array<"LIKE"|"COMMENT"|"FOLLOW"|"FRIEND_REQUEST"|"FRIEND_ACCEPTED"|"MESSAGE"|"MENTION"|"SHARE"|"SYSTEM">;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(enabledTypes.length ? { type: { in: enabledTypes } } : { id: { in: [] } }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { id: true, name: true, username: true, image: true } },
      post: { select: { id: true, content: true, mediaUrl: true } },
      comment: { select: { id: true, content: true } },
      message: { select: { id: true, conversationId: true } },
    },
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = notificationUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification update." }, { status: 400 });

  if (parsed.data.markAll) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    const notification = await prisma.notification.findFirst({
      where: { id: parsed.data.notificationId, userId: session.user.id },
      select: { id: true },
    });
    if (!notification) return NextResponse.json({ error: "Notification not found." }, { status: 404 });

    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
