import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";
import { getPostDisplayCountsMap } from "@/lib/post-metrics";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 24), 1), 50);
  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.savedPost.findMany({
    where: { userId: session.user.id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: {
      post: {
        include: {
          author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
          _count: { select: { likes: true, comments: true } },
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const candidates = rows.slice(0, take);
  const visibility = await Promise.all(candidates.map(async (row) => ({ row, access: await canViewPost(row.post.id, session.user.id) })));
  const visible = visibility.filter(({ access }) => access.allowed).map(({ row }) => row);
  const display = await getPostDisplayCountsMap(visible.map((row) => row.post.id));
  return NextResponse.json({
    posts: visible.map((row) => ({
      ...row.post,
      savedAt: row.createdAt,
      displayCounts: {
        likes: display.get(row.post.id)?.likes ?? row.post._count.likes,
        comments: display.get(row.post.id)?.comments ?? row.post._count.comments,
        shares: display.get(row.post.id)?.shares ?? row.post.shareCount,
      },
      saved: true,
    })),
    nextCursor: hasMore && visible.length ? visible[visible.length - 1].savedAt.toISOString() : null,
  });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { postId } = await request.json().catch(() => ({}));
  if (typeof postId !== "string" || !postId) return NextResponse.json({ error: "Post id is required." }, { status: 400 });
  await prisma.savedPost.deleteMany({ where: { userId: session.user.id, postId } });
  return NextResponse.json({ saved: false });
}
