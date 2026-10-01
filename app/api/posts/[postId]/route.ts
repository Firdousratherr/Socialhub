import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postInputSchema } from "@/lib/validation";

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
    select: { id: true, authorId: true },
  });
  if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (existing.authorId !== session.user.id) return NextResponse.json({ error: "You can only edit your own posts." }, { status: 403 });

  const parsed = postInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post." }, { status: 400 });
  }

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
    select: { id: true, authorId: true },
  });
  if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (existing.authorId !== session.user.id) return NextResponse.json({ error: "You can only delete your own posts." }, { status: 403 });

  await prisma.post.delete({ where: { id: postId } });
  return NextResponse.json({ success: true });
}
