import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "You can only pin your own posts." }, { status: 403 });
  }

  const pinned = await prisma.$transaction(async (tx) => {
    await tx.post.updateMany({
      where: { authorId: session.user.id, isPinned: true },
      data: { isPinned: false },
    });

    return tx.post.update({
      where: { id: postId },
      data: { isPinned: true },
      select: { id: true, isPinned: true },
    });
  });

  return NextResponse.json({ post: pinned });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "You can only unpin your own posts." }, { status: 403 });
  }

  await prisma.post.update({
    where: { id: postId },
    data: { isPinned: false },
  });

  return NextResponse.json({ post: { id: postId, isPinned: false } });
}
