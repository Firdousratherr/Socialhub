import { prisma } from "@/lib/prisma";

type RealtimeEventInput = {
  type: string;
  conversationId?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

function decodeCursor(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
    if (!parsed.createdAt || !parsed.id) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

async function createForUser(userId: string, event: RealtimeEventInput) {
  return prisma.realtimeEvent.create({
    data: {
      recipientId: userId,
      type: event.type,
      conversationId: event.conversationId ?? null,
      entityId: event.entityId ?? null,
      payload: JSON.stringify(event.payload ?? {}),
    },
  });
}

export async function publishUserEvent(userId: string, event: RealtimeEventInput) {
  return createForUser(userId, event);
}

export async function publishConversationEvent(
  conversationId: string,
  event: RealtimeEventInput,
  excludeUserId?: string,
) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  const recipientIds = members
    .map((member) => member.userId)
    .filter((userId) => userId !== excludeUserId);

  if (!recipientIds.length) return { count: 0 };

  return prisma.realtimeEvent.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      type: event.type,
      conversationId,
      entityId: event.entityId ?? null,
      payload: JSON.stringify(event.payload ?? {}),
    })),
  });
}

export async function readRealtimeEvents(userId: string, cursorValue: string | null, take = 50) {
  const cursor = decodeCursor(cursorValue);
  const limit = Math.min(Math.max(Math.trunc(take) || 50, 1), 100);

  const rows = await prisma.realtimeEvent.findMany({
    where: {
      recipientId: userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit);
  const last = events.at(-1);

  return {
    events: events.map((event) => {
      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(event.payload);
        if (parsed && typeof parsed === "object") payload = parsed;
      } catch {
        // Ignore malformed legacy event payloads.
      }
      return {
        id: event.id,
        type: event.type,
        conversationId: event.conversationId,
        entityId: event.entityId,
        payload,
        createdAt: event.createdAt,
      };
    }),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : last ? encodeCursor(last.createdAt, last.id) : cursorValue,
  };
}
