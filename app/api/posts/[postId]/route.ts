export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const session = await getSession();
  const access = await canViewPost(postId, session?.user?.id);
  if (!access.allowed) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const displayCounts = await getPostDisplayCounts(post.id, {
    likes: post._count.likes,
    comments: post._count.comments,
    shares: post.shareCount,
  });

  const [liked, saved, reactions, mine] = session?.user
    ? await Promise.all([
        prisma.like.findUnique({ where: { postId_userId: { postId, userId: session.user.id } }, select: { id: true } }),
        prisma.savedPost.findUnique({ where: { userId_postId: { userId: session.user.id, postId } }, select: { id: true } }),
        prisma.postReaction.groupBy({ by: ["emoji"], where: { postId }, _count: { _all: true } }),
        prisma.postReaction.findUnique({ where: { postId_userId: { postId, userId: session.user.id } }, select: { emoji: true } }),
      ])
    : [null, null, await prisma.postReaction.groupBy({ by: ["emoji"], where: { postId }, _count: { _all: true } }), null];

  return NextResponse.json({
    post: {
      ...post,
      displayCounts,
      liked: Boolean(liked),
      saved: Boolean(saved),
      reactions: reactions.map((row) => ({ emoji: row.emoji, count: row._count._all })),
      myReaction: mine?.emoji ?? null,
    },
  });
}

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postInputSchema } from "@/lib/validation";
import { safeDeleteBlob } from "@/lib/blob-cleanup";
import { canViewPost } from "@/lib/post-access";
import { getPostDisplayCounts } from "@/lib/post-metrics";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, mediaUrl: true },
  });
  if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (existing.authorId !== session.user.id) return NextResponse.json({ error: "You can only edit your own posts." }, { status: 403 });

  const parsed = postInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post." }, { status: 400 });
  }

  const previousMedia = await prisma.post.findUnique({ where: { id: postId }, select: { mediaUrl: true } });
  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      content: parsed.data.content ?? null,
      mediaUrl: parsed.data.mediaUrl ?? null,
      visibility: parsed.data.visibility,
    },
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (previousMedia?.mediaUrl && previousMedia.mediaUrl !== post.mediaUrl) void safeDeleteBlob(previousMedia.mediaUrl);
  return NextResponse.json({ post });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, mediaUrl: true },
  });
  if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (existing.authorId !== session.user.id) return NextResponse.json({ error: "You can only delete your own posts." }, { status: 403 });

  await prisma.post.delete({ where: { id: postId } });
  void safeDeleteBlob(existing.mediaUrl);
  return NextResponse.json({ success: true });
}
