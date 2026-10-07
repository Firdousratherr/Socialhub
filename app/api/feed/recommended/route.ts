import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIds, getMutedUserIds } from "@/lib/social-access";

function score(createdAt: Date, relation: number, engagement: number, authorAffinity: number) {
  const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / 3_600_000);
  const freshness = Math.exp(-ageHours / 30);
  return relation * 4 + authorAffinity * 2 + engagement * 0.02 + freshness * 6;
}

export async function GET(request: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const takeRaw = Number(new URL(request.url).searchParams.get("take") ?? "20");
  const take = Math.min(Math.max(Math.trunc(takeRaw) || 20, 1), 40);

  const [blockedIds, mutedIds, following, friends] = await Promise.all([
    getBlockedUserIds(s.user.id),
    getMutedUserIds(s.user.id),
    prisma.follow.findMany({ where: { followerId: s.user.id }, select: { followingId: true } }),
    prisma.friendRequest.findMany({
      where: { status: "ACCEPTED", OR: [{ senderId: s.user.id }, { receiverId: s.user.id }] },
      select: { senderId: true, receiverId: true },
    }),
  ]);

  const followingIds = new Set(following.map((row) => row.followingId));
  const friendIds = new Set(friends.map((row) => row.senderId === s.user.id ? row.receiverId : row.senderId));
  const excluded = [...new Set([...blockedIds, ...mutedIds, s.user.id])];

  const candidates = await prisma.post.findMany({
    where: {
      authorId: { notIn: excluded },
      author: { isActive: true },
      visibility: "PUBLIC",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(take * 4, 120),
    include: {
      author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const postIds = candidates.map((post) => post.id);
  const recentInteractions = postIds.length
    ? await prisma.recommendationEvent.findMany({
        where: { userId: s.user.id, postId: { in: postIds }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
        select: { postId: true, weight: true },
      })
    : [];

  const affinityByPost = new Map<string, number>();
  for (const event of recentInteractions) affinityByPost.set(event.postId, (affinityByPost.get(event.postId) ?? 0) + event.weight);

  const ranked = [...candidates]
    .map((post) => {
      const relation = friendIds.has(post.authorId) ? 2 : followingIds.has(post.authorId) ? 1 : 0;
      const engagement = post._count.likes + post._count.comments + post.shareCount;
      const authorAffinity = affinityByPost.get(post.id) ?? 0;
      return { post, rankingScore: score(post.createdAt, relation, engagement, authorAffinity) };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, take);

  return NextResponse.json({
    posts: ranked.map(({ post, rankingScore }) => ({ ...post, rankingScore })),
    generatedAt: new Date().toISOString(),
  });
}
