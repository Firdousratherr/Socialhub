import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";
import { getPostDisplayCountsMap } from "@/lib/post-metrics";

function decodeCursor(value: string | null) {
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { isPinned?: boolean; createdAt?: string; id?: string };
    if (typeof payload.isPinned !== "boolean" || !payload.createdAt || !payload.id) return null;
    const createdAt = new Date(payload.createdAt);
    return Number.isNaN(createdAt.getTime()) ? null : { isPinned: payload.isPinned, createdAt, id: payload.id };
  } catch {
    return null;
  }
}

function encodeCursor(isPinned: boolean, createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ isPinned, createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const url = new URL(request.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 20), 1), 50);
  const cursor = decodeCursor(url.searchParams.get("before"));
  if (url.searchParams.get("before") && !cursor) {
    return NextResponse.json({ error: "Invalid post cursor." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isActive: true, isPrivate: true },
  });
  if (!user?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const isSelf = viewerId === user.id;
  if (viewerId && !isSelf && await isBlocked(viewerId, user.id)) {
    return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
  }

  const friends = Boolean(viewerId && await areFriends(viewerId, user.id));
  if (user.isPrivate && !isSelf && !friends) {
    return NextResponse.json({ posts: [], nextBefore: null });
  }

  const visible = [
    { visibility: "PUBLIC" as const },
    ...(isSelf || friends ? [{ visibility: "FRIENDS" as const }] : []),
    ...(isSelf ? [{ visibility: "PRIVATE" as const }] : []),
  ];

  const rows = await prisma.post.findMany({
    where: {
      authorId: user.id,
      AND: [
        { OR: visible },
        ...(cursor
          ? [cursor.isPinned
              ? {
                  OR: [
                    { isPinned: false },
                    {
                      isPinned: true,
                      OR: [
                        { createdAt: { lt: cursor.createdAt } },
                        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                      ],
                    },
                  ],
                }
              : {
                  isPinned: false,
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                }]
          : []),
      ],
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: {
      id: true,
      content: true,
      mediaUrl: true,
      visibility: true,
      shareCount: true,
      isPinned: true,
      createdAt: true,
      _count: { select: { likes: true, comments: true } },
    },
  });

  const hasMore = rows.length > take;
  const posts = rows.slice(0, take);
  const postDisplayCounts = await getPostDisplayCountsMap(posts.map((post) => post.id));
  const visiblePosts = posts.map((post) => {
    const display = postDisplayCounts.get(post.id);
    return {
      ...post,
      displayCounts: {
        likes: display?.likes ?? post._count.likes,
        comments: display?.comments ?? post._count.comments,
        shares: display?.shares ?? post.shareCount,
      },
    };
  });
  return NextResponse.json({
    posts: visiblePosts,
    nextBefore: hasMore && posts.length ? encodeCursor(posts.at(-1)!.isPinned, posts.at(-1)!.createdAt, posts.at(-1)!.id) : null,
  });
}
