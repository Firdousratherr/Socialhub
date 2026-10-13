import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIds } from "@/lib/social-access";

const TAG = /(^|\s)#([a-zA-Z0-9_]{2,40})/g;

const getRecentPublicTrendPosts = unstable_cache(
  async () =>
    prisma.post.findMany({
      where: {
        visibility: "PUBLIC",
        author: { isActive: true },
        content: { not: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 300,
      select: { authorId: true, content: true },
    }),
  ["socialhub-public-trend-posts-v1"],
  { revalidate: 60, tags: ["socialhub-trends"] },
);

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  const [blockedIds, posts] = await Promise.all([
    session?.user ? getBlockedUserIds(session.user.id) : Promise.resolve([]),
    getRecentPublicTrendPosts(),
  ]);
  const blockedSet = new Set(blockedIds);

  const counts = new Map<string, number>();
  for (const post of posts) {
    if (blockedSet.has(post.authorId)) continue;
    const seen = new Set<string>();
    for (const match of post.content?.matchAll(TAG) ?? []) {
      const tag = match[2].toLowerCase();
      if (!seen.has(tag)) {
        seen.add(tag);
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }

  const trends = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, posts]) => ({ tag: `#${tag}`, posts }));

  return NextResponse.json({ trends });
}
