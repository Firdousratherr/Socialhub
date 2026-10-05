import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limit = await consumeRateLimit(rateLimitKey("account-export", request, session.user.id), 1, 3600);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const userId = session.user.id;

  const [profile, posts, comments, likes, followers, following, friendRequests, savedPosts, stories, storyReplies, storyReactions, settingsPair, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, username: true, bio: true, image: true, coverImage: true, website: true, location: true, isPrivate: true, isVerified: true, createdAt: true } }),
    prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, content: true, mediaUrl: true, visibility: true, shareCount: true, isPinned: true, createdAt: true, updatedAt: true } }),
    prisma.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, postId: true, parentId: true, content: true, createdAt: true, updatedAt: true } }),
    prisma.like.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, postId: true, createdAt: true } }),
    prisma.follow.findMany({ where: { followerId: userId }, orderBy: { createdAt: "asc" }, select: { followingId: true, createdAt: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, orderBy: { createdAt: "asc" }, select: { followerId: true, createdAt: true } }),
    prisma.friendRequest.findMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] }, orderBy: { createdAt: "asc" }, select: { id: true, senderId: true, receiverId: true, status: true, createdAt: true, updatedAt: true } }),
    prisma.savedPost.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { postId: true, createdAt: true } }),
    prisma.story.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, mediaUrl: true, mediaType: true, caption: true, audience: true, expiresAt: true, createdAt: true } }),
    prisma.storyReply.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, storyId: true, content: true, createdAt: true } }),
    prisma.storyReaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, storyId: true, emoji: true, createdAt: true } }),
    Promise.all([prisma.userPrivacySetting.findUnique({ where: { userId } }), prisma.notificationPreference.findUnique({ where: { userId } })]),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 10000, select: { id: true, actorId: true, type: true, postId: true, commentId: true, messageId: true, storyId: true, title: true, body: true, readAt: true, createdAt: true } }),
  ]);
  const [privacySettings, notificationPreferences] = settingsPair;
  const payload = { exportVersion: 1, exportedAt: new Date().toISOString(), note: "This account-data snapshot excludes authentication secrets and other users private message content.", profile, posts, comments, likes, connections: { followers, following, friendRequests }, savedPosts, stories, storyReplies, storyReactions, settings: { privacy: privacySettings, notifications: notificationPreferences }, notifications };
  return new NextResponse(JSON.stringify(payload, null, 2), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="socialhub-account-data.json"', "Cache-Control": "no-store" } });
}