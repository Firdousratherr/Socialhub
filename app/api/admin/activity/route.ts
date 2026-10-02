import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: Request) {
  const authResult = await requireAdminPermission("USERS_VIEW");
  if (authResult.response) return authResult.response;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      isActive: true,
      isPrivate: true,
      role: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const [posts, comments, likes, follows, friends, notifications, stories, sessions] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, content: true, createdAt: true, visibility: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, content: true, createdAt: true, postId: true },
    }),
    prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, postId: true, createdAt: true },
    }),
    prisma.follow.findMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { followerId: true, followingId: true, createdAt: true },
    }),
    prisma.friendRequest.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, senderId: true, receiverId: true, status: true, updatedAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, readAt: true, createdAt: true, actorId: true },
    }),
    prisma.story.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, caption: true, createdAt: true, expiresAt: true },
    }),
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    }),
  ]);

  await prisma.adminAuditLog.create({
    data: {
      adminId: authResult.user.id,
      action: "VIEW_USER_ACTIVITY",
      targetType: "USER",
      targetId: userId,
    },
  });

  return NextResponse.json({ user, posts, comments, likes, follows, friends, notifications, stories, sessions });
}
