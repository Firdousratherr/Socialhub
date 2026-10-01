import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentInputSchema } from "@/lib/validation";
import { areFriends, isBlocked } from "@/lib/social-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, visibility: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (session?.user && await isBlocked(session.user.id, post.authorId)) {
    return NextResponse.json({ error: "Post unavailable." }, { status: 404 });
  }
  if (post.visibility === "PRIVATE" && session?.user?.id !== post.authorId) {
    return NextResponse.json({ error: "Post unavailable." }, { status: 404 });
  }
  if (post.visibility === "FRIENDS" && session?.user?.id !== post.authorId) {
    const friends = session?.user ? await areFriends(session.user.id, post.authorId) : false;
    if (!friends) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      author: {
        select: { id: true, name: true, username: true, image: true },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      },
    },
  });
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, visibility: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (await isBlocked(session.user.id, post.authorId)) {
    return NextResponse.json({ error: "Post unavailable." }, { status: 404 });
  }
  if (post.visibility === "PRIVATE" && post.authorId !== session.user.id) {
    return NextResponse.json({ error: "You cannot comment on this post." }, { status: 403 });
  }
  if (post.visibility === "FRIENDS" && post.authorId !== session.user.id && !(await areFriends(session.user.id, post.authorId))) {
    return NextResponse.json({ error: "You cannot comment on this post." }, { status: 403 });
  }

  const parsed = commentInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid comment." },
      { status: 400 },
    );
  }

  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { postId: true },
    });
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: "Reply target not found." }, { status: 400 });
    }
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: session.user.id,
      parentId: parsed.data.parentId ?? null,
      content: parsed.data.content,
    },
    include: {
      author: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
  });

  if (post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: post.authorId,
        actorId: session.user.id,
        type: "COMMENT",
        postId,
        commentId: comment.id,
      },
    });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
