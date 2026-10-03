import { prisma } from "@/lib/prisma";

export function extractMentionUsernames(content: string) {
  return [...new Set([...content.matchAll(/(^|\s)@([A-Za-z0-9_]{2,32})\b/g)].map((match) => match[2].toLowerCase()))];
}

export async function createMentionNotifications(content: string, actorId: string, target: { postId?: string; commentId?: string }) {
  const usernames = extractMentionUsernames(content);
  if (!usernames.length) return;

  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, isActive: true, id: { not: actorId } },
    select: { id: true },
  });
  if (!users.length) return;

  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: users.map((user) => user.id) } },
    select: { userId: true, mentions: true },
  });
  const preferenceMap = new Map(preferences.map((item) => [item.userId, item.mentions]));
  const rows = users
    .filter((user) => preferenceMap.get(user.id) !== false)
    .map((user) => ({
      userId: user.id,
      actorId,
      type: "MENTION" as const,
      postId: target.postId ?? null,
      commentId: target.commentId ?? null,
    }));
  if (rows.length) await prisma.notification.createMany({ data: rows });
}
