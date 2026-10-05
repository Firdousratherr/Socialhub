import { NextResponse } from "next/server";
import { consumeMutationRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("likes", _request, session.user.id, 60, 60);

  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed || !access.post) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  const result = await prisma.like.createMany({
    data: [{ postId, userId: session.user.id }],
    skipDuplicates: true,
  });

  if (result.count > 0 && access.post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: access.post.authorId,
        actorId: session.user.id,
        type: "LIKE",
        postId,
      },
    });
  }

  const actualCount = await prisma.like.count({ where: { postId } });
  const override = await prisma.adminPostMetricOverride.findUnique({ where: { postId }, select: { likes: true } });
  return NextResponse.json({ liked: true, count: override?.likes ?? actualCount });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("likes", _request, session.user.id, 60, 60);

  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed || !access.post) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  await prisma.like.deleteMany({
    where: { postId, userId: session.user.id },
  });

  await prisma.notification.deleteMany({
    where: {
      userId: access.post.authorId,
      actorId: session.user.id,
      postId,
      type: "LIKE",
    },
  });

  const actualCount = await prisma.like.count({ where: { postId } });
  const override = await prisma.adminPostMetricOverride.findUnique({ where: { postId }, select: { likes: true } });
  return NextResponse.json({ liked: false, count: override?.likes ?? actualCount });
}
