import { prisma } from "@/lib/prisma";

export async function getBlockedUserIds(userId: string) {
  const rows = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}

export async function areFriends(userA: string, userB: string) {
  if (userA === userB) return true;

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userA, receiverId: userB },
        { senderId: userB, receiverId: userA },
      ],
    },
    select: { id: true },
  });

  return Boolean(friendship);
}

export async function isBlocked(userA: string, userB: string) {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { blockerId: true },
  });

  return Boolean(row);
}
