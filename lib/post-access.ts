import { prisma } from "@/lib/prisma";
import { isBlocked } from "@/lib/social-access";

type PostVisibility = "PUBLIC" | "FRIENDS" | "PRIVATE";

export async function getPostForAccess(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      visibility: true,
      author: { select: { isActive: true } },
    },
  });
}

export async function canViewPost(postId: string, userId?: string | null) {
  const post = await getPostForAccess(postId);
  if (!post || !post.author.isActive) return { allowed: false as const, post: null };

  if (userId && await isBlocked(userId, post.authorId)) {
    return { allowed: false as const, post: null };
  }

  const visibility = post.visibility as PostVisibility;
  if (visibility === "PUBLIC") {
    return { allowed: true as const, post };
  }

  if (!userId) {
    return { allowed: false as const, post: null };
  }

  if (post.authorId === userId) {
    return { allowed: true as const, post };
  }

  if (visibility === "PRIVATE") {
    return { allowed: false as const, post: null };
  }

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userId, receiverId: post.authorId },
        { senderId: post.authorId, receiverId: userId },
      ],
    },
    select: { id: true },
  });

  return friendship
    ? { allowed: true as const, post }
    : { allowed: false as const, post: null };
}
