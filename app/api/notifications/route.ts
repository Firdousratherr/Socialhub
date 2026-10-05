import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationUpdateSchema } from "@/lib/validation";
import { getMutedUserIds } from "@/lib/social-access";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const mutedIds = await getMutedUserIds(session.user.id);
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
    preferences.storyReplies ? "STORY_REPLY" : null,
    preferences.storyReactions ? "STORY_REACTION" : null,
  ].filter(Boolean) as Array<"LIKE"|"COMMENT"|"FOLLOW"|"FRIEND_REQUEST"|"FRIEND_ACCEPTED"|"MESSAGE"|"MENTION"|"SHARE"|"SYSTEM"|"STORY_REPLY"|"STORY_REACTION">;

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
      return NextResponse.json({ error: "Invalid notification cursor." }, { status: 400 });
    }
  }

  const rows = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(enabledTypes.length ? { type: { in: enabledTypes } } : { id: { in: [] } }),
      AND: [
        ...(mutedIds.length ? [{ OR: [{ actorId: null }, { actorId: { notIn: mutedIds } }] }] : []),
        ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    include: {
      actor: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      post: { select: { id: true, content: true, mediaUrl: true } },
      comment: { select: { id: true, content: true } },
      message: { select: { id: true, conversationId: true } },
      story: { select: { id: true } },
    },
  });

  const hasMore = rows.length > 50;
  const notifications = rows.slice(0, 50);
  const oldest = notifications.at(-1);
  const nextBefore = hasMore && oldest ? Buffer.from(JSON.stringify({ createdAt: oldest.createdAt.toISOString(), id: oldest.id })).toString("base64url") : null;

  return NextResponse.json({ notifications, nextBefore });
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
