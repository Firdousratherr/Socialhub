import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIds } from "@/lib/social-access";

const TAG = /(^|\s)#([a-zA-Z0-9_]{2,40})/g;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  const blockedIds = session?.user ? await getBlockedUserIds(session.user.id) : [];

  const posts = await prisma.post.findMany({
    where: {
      visibility: "PUBLIC",
      ...(blockedIds.length ? { authorId: { notIn: blockedIds } } : {}),
      author: { isActive: true },
      content: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { content: true },
  });

  const counts = new Map<string, number>();
  for (const post of posts) {
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
