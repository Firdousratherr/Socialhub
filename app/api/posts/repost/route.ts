import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  postId: z.string().trim().min(1),
  quoteText: z.string().max(5000).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid repost request." }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: parsed.data.postId }, select: { id: true, authorId: true, visibility: true } });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.visibility !== "PUBLIC" && post.authorId !== session.user.id) {
    return NextResponse.json({ error: "This post cannot be reposted." }, { status: 403 });
  }

  const repost = await prisma.repost.upsert({
    where: { userId_originalPostId: { userId: session.user.id, originalPostId: post.id } },
    create: { userId: session.user.id, originalPostId: post.id, quoteText: parsed.data.quoteText ?? null },
    update: { quoteText: parsed.data.quoteText ?? null },
  });

  await prisma.post.update({ where: { id: post.id }, data: { shareCount: { increment: 1 } } });
  return NextResponse.json({ repost }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const postId = new URL(request.url).searchParams.get("postId")?.trim();
  if (!postId) return NextResponse.json({ error: "Post ID is required." }, { status: 400 });

  const deleted = await prisma.repost.deleteMany({ where: { userId: session.user.id, originalPostId: postId } });
  if (deleted.count) await prisma.post.update({ where: { id: postId }, data: { shareCount: { decrement: 1 } } });
  return NextResponse.json({ removed: deleted.count > 0 });
}
