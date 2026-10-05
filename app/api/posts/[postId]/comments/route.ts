import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentInputSchema } from "@/lib/validation";
import { canViewPost } from "@/lib/post-access";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { createMentionNotifications } from "@/lib/mentions";
import { getActiveUserRestriction } from "@/lib/user-restrictions";

function decodeCursor(value: string | null) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
    if (!decoded.createdAt || !decoded.id) return null;
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: decoded.id };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

function blockedAuthorWhere(viewerId?: string) {
  if (!viewerId) return {};
  return {
    author: {
      blockedBy: { none: { blockerId: viewerId } },
      blockedUsers: { none: { blockedId: viewerId } },
    },
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id;
  const access = await canViewPost(postId, viewerId);
  if (!access.allowed) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  const url = new URL(request.url);
  const cursor = decodeCursor(url.searchParams.get("before"));
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 30), 1), 50);
  const countWhere = {
    postId,
    ...blockedAuthorWhere(viewerId),
  };
  const [comments, commentCount, override] = await Promise.all([
    prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
        ...blockedAuthorWhere(viewerId),
        ...(cursor ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        } : {}),
      },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: {
      author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      replies: {
        where: blockedAuthorWhere(viewerId),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 20,
        include: { author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } } },
      },
    },
    }),
    prisma.comment.count({ where: countWhere }),
    prisma.adminPostMetricOverride.findUnique({ where: { postId }, select: { comments: true } }),
  ]);


  const hasMore = comments.length > take;
  const page = comments.slice(0, take).reverse();
  const nextBefore = hasMore && page.length ? encodeCursor(page[0].createdAt, page[0].id) : null;
  return NextResponse.json({ comments: page, nextBefore, commentCount: override?.comments ?? commentCount });
}

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rl = await consumeRateLimit(rateLimitKey("comments", request, session.user.id), 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);
  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  const parsed = commentInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid comment." }, { status: 400 });

  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { postId: true, authorId: true },
    });
    if (!parent || parent.postId !== postId) return NextResponse.json({ error: "Reply target not found." }, { status: 400 });
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: parent.authorId },
          { blockerId: parent.authorId, blockedId: session.user.id },
        ],
      },
      select: { blockerId: true },
    });
    if (blocked) return NextResponse.json({ error: "Reply target is unavailable." }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: { postId, authorId: session.user.id, parentId: parsed.data.parentId ?? null, content: parsed.data.content },
    include: { author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } } },
  });

  if (access.post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: access.post.authorId, actorId: session.user.id, type: "COMMENT", postId, commentId: comment.id },
    });
  }
  await createMentionNotifications(parsed.data.content, session.user.id, { postId, commentId: comment.id });
  const commentCount = await prisma.comment.count({ where: { postId } });
  const override = await prisma.adminPostMetricOverride.findUnique({ where: { postId }, select: { comments: true } });
  return NextResponse.json({ comment, commentCount: override?.comments ?? commentCount }, { status: 201 });
}


export async function PATCH(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  const body = await request.json().catch(() => null) as { commentId?: string; content?: string } | null;
  const commentId = typeof body?.commentId === "string" ? body.commentId : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!commentId || content.length < 1 || content.length > 2000) {
    return NextResponse.json({ error: "Provide valid comment content." }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, parentId: true },
  });
  if (!comment || comment.postId !== postId) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  if (comment.authorId !== session.user.id) return NextResponse.json({ error: "You can only edit your own comments." }, { status: 403 });

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: { author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } } },
  });
  return NextResponse.json({ comment: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  const body = await request.json().catch(() => null) as { commentId?: string } | null;
  const commentId = typeof body?.commentId === "string" ? body.commentId : "";
  if (!commentId) return NextResponse.json({ error: "Comment id is required." }, { status: 400 });

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true },
  });
  if (!comment || comment.postId !== postId) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  if (comment.authorId !== session.user.id) return NextResponse.json({ error: "You can only delete your own comments." }, { status: 403 });

  await prisma.comment.delete({ where: { id: commentId } });
  const commentCount = await prisma.comment.count({ where: { postId } });
  const override = await prisma.adminPostMetricOverride.findUnique({ where: { postId }, select: { comments: true } });
  return NextResponse.json({ success: true, commentId, commentCount: override?.comments ?? commentCount });
}
