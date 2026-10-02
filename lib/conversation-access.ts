import { prisma } from "@/lib/prisma";

export type ConversationAccessResult = {
  allowed: boolean;
  reason?: string;
};

async function areFriends(userA: string, userB: string) {
  return Boolean(await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userA, receiverId: userB },
        { senderId: userB, receiverId: userA },
      ],
    },
    select: { id: true },
  }));
}

async function isBlocked(userA: string, userB: string) {
  return Boolean(await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { blockerId: true },
  }));
}

export async function canStartConversationWith(viewerId: string, targetId: string): Promise<ConversationAccessResult> {
  if (viewerId === targetId) {
    return { allowed: false, reason: "You cannot start a conversation with yourself." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      isActive: true,
      privacySetting: { select: { allowMessagesEveryone: true } },
    },
  });

  if (!target?.isActive) {
    return { allowed: false, reason: "User not found." };
  }

  if (await isBlocked(viewerId, targetId)) {
    return { allowed: false, reason: "You cannot message this user while a block is active." };
  }

  if (target.privacySetting?.allowMessagesEveryone === false && !(await areFriends(viewerId, targetId))) {
    return { allowed: false, reason: "This user only accepts messages from friends." };
  }

  return { allowed: true };
}

export async function canCreateGroupWith(viewerId: string, targetIds: string[]): Promise<ConversationAccessResult> {
  for (const targetId of Array.from(new Set(targetIds))) {
    const result = await canStartConversationWith(viewerId, targetId);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

export async function canSendMessageInConversation(conversationId: string, viewerId: string): Promise<ConversationAccessResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      isGroup: true,
      members: { select: { userId: true } },
    },
  });

  if (!conversation) return { allowed: false, reason: "Conversation not found." };
  if (!conversation.members.some((member) => member.userId === viewerId)) {
    return { allowed: false, reason: "Conversation access denied." };
  }

  if (conversation.isGroup || conversation.members.length !== 2) {
    return { allowed: true };
  }

  const otherId = conversation.members.find((member) => member.userId !== viewerId)?.userId;
  if (!otherId) return { allowed: false, reason: "Conversation members are invalid." };

  return canStartConversationWith(viewerId, otherId);
}

export async function getConversationAdmin(conversationId: string, userId: string) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, role: true, conversation: { select: { isGroup: true } } },
  });
}
