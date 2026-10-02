import { prisma } from "@/lib/prisma";

export type PostDisplayCounts = {
  likes: number;
  comments: number;
  shares: number;
};

export async function getPostDisplayCounts(postId: string, actual: PostDisplayCounts): Promise<PostDisplayCounts> {
  const override = await prisma.adminPostMetricOverride.findUnique({
    where: { postId },
    select: { likes: true, comments: true, shares: true },
  });
  return {
    likes: override?.likes ?? actual.likes,
    comments: override?.comments ?? actual.comments,
    shares: override?.shares ?? actual.shares,
  };
}

export async function getPostDisplayCountsMap(postIds: string[]) {
  if (!postIds.length) return new Map<string, PostDisplayCounts>();
  const overrides = await prisma.adminPostMetricOverride.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true, likes: true, comments: true, shares: true },
  });
  return new Map(overrides.map((item) => [item.postId, item]));
}
