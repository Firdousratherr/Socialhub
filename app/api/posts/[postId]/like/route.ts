import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (!existing) {
    await prisma.like.create({
      data: { postId, userId: session.user.id },
    });

    if (post.authorId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          actorId: session.user.id,
          type: "LIKE",
          postId,
        },
      });
    }
  }

  const count = await prisma.like.count({ where: { postId } });
  return NextResponse.json({ liked: true, count });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  await prisma.like.deleteMany({
    where: { postId, userId: session.user.id },
  });

  await prisma.notification.deleteMany({
    where: {
      userId: { not: session.user.id },
      actorId: session.user.id,
      postId,
      type: "LIKE",
    },
  });

  const count = await prisma.like.count({ where: { postId } });
  return NextResponse.json({ liked: false, count });
}
