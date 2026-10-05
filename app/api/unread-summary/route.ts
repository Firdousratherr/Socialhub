import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMutedUserIds } from "@/lib/social-access";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
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
  ].filter(Boolean) as Array<
    "LIKE" | "COMMENT" | "FOLLOW" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "MESSAGE" | "MENTION" | "SHARE" | "SYSTEM"
  >;

  const [notificationCount, friendRequestCount, unreadRows] = await Promise.all([
    prisma.notification.count({
      where: {
        userId: session.user.id,
        readAt: null,
        ...(enabledTypes.length ? { type: { in: enabledTypes, not: "MESSAGE" } } : { id: { in: [] } }),
        ...(mutedIds.length ? { actorId: { notIn: mutedIds } } : {}),
      },
    }),
    prisma.friendRequest.count({
      where: { receiverId: session.user.id, status: "PENDING" },
    }),
    prisma.$queryRaw<Array<{ unreadCount: bigint }>>`
      SELECT COUNT(*)::bigint AS "unreadCount"
      FROM "Message" m
      INNER JOIN "ConversationMember" cm
        ON cm."conversationId" = m."conversationId"
       AND cm."userId" = ${session.user.id}
      WHERE m."senderId" <> ${session.user.id}
        AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
    `,
  ]);

  const messages = Number(unreadRows[0]?.unreadCount ?? BigInt(0));
  const notifications = notificationCount;
  const friendRequests = friendRequestCount;

  return NextResponse.json({
    messages,
    notifications,
    friendRequests,
    total: messages + notifications + friendRequests,
  });
}
