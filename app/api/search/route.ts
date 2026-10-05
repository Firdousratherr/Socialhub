import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIds } from "@/lib/social-access";
import { getPostDisplayCountsMap } from "@/lib/post-metrics";
import { publicUserWhere } from "@/lib/user-visibility";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 20), 1), 50);
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id;

  let blockedIds: string[] = [];
  let friendIds: string[] = [];
  let pendingFriendRequests: Array<{ senderId: string; receiverId: string; id: string }> = [];
  if (viewerId) {
    blockedIds = await getBlockedUserIds(viewerId);
    pendingFriendRequests = await prisma.friendRequest.findMany({
      where: {
        status: "PENDING",
        OR: [{ senderId: viewerId }, { receiverId: viewerId }],
      },
      select: { senderId: true, receiverId: true, id: true },
    });
    friendIds = (
      await prisma.friendRequest.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ senderId: viewerId }, { receiverId: viewerId }],
        },
        select: { senderId: true, receiverId: true },
      })
    ).map((row) => row.senderId === viewerId ? row.receiverId : row.senderId);
  }

  const [users, posts] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...publicUserWhere,
        ...(viewerId ? { id: { not: viewerId } } : {}),
        ...(blockedIds.length ? { id: { notIn: blockedIds } } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
            { username: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true, name: true, username: true, image: true, bio: true, isPrivate: true, isVerified: true, isOwner: true,
        _count: { select: { followers: true } },
      },
    }),
    prisma.post.findMany({
      where: {
        author: {
          is: publicUserWhere,
          ...(blockedIds.length ? { id: { notIn: blockedIds } } : {}),
        },
        ...(q ? { content: { contains: q.replace(/^#/, ""), mode: "insensitive" } } : {}),
        OR: [
          { visibility: "PUBLIC" },
          ...(viewerId ? [
            { authorId: viewerId },
            ...(friendIds.length ? [{ visibility: "FRIENDS" as const, authorId: { in: friendIds } }] : []),
          ] : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: {
        author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);

  const followingIds = viewerId
    ? new Set((await prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: users.map((user) => user.id) } },
        select: { followingId: true },
      })).map((row) => row.followingId))
    : new Set<string>();

  const friendRequestMap = new Map<string, "SELF_PENDING" | "OUTGOING_PENDING" | "INCOMING_PENDING" | "NONE">();
  for (const user of users) {
    if (!viewerId) {
      friendRequestMap.set(user.id, "NONE");
      continue;
    }
    const pending = pendingFriendRequests.find((row) => row.senderId === user.id || row.receiverId === user.id);
    friendRequestMap.set(
      user.id,
      !pending ? "NONE" : pending.senderId === viewerId ? "OUTGOING_PENDING" : "INCOMING_PENDING",
    );
  }

  const hashtags = new Map<string, number>();
  for (const post of posts) {
    for (const match of post.content?.matchAll(/(^|\s)#([A-Za-z0-9_]{2,40})/g) ?? []) {
      const tag = match[2].toLowerCase();
      hashtags.set(tag, (hashtags.get(tag) ?? 0) + 1);
    }
  }

  const [postDisplayCounts, userMetricOverrides] = await Promise.all([
    getPostDisplayCountsMap(posts.map((post) => post.id)),
    prisma.adminMetricOverride.findMany({
      where: { userId: { in: users.map((user) => user.id) } },
      select: { userId: true, followers: true, following: true },
    }),
  ]);
  const userMetricById = new Map(userMetricOverrides.map((row) => [row.userId, row]));
  const visiblePosts = posts.map((post) => {
    const display = postDisplayCounts.get(post.id);
    return {
      ...post,
      displayCounts: {
        likes: display?.likes ?? post._count.likes,
        comments: display?.comments ?? post._count.comments,
        shares: display?.shares ?? post.shareCount,
      },
    };
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      displayCounts: {
        followers: userMetricById.get(user.id)?.followers ?? user._count.followers,
        following: userMetricById.get(user.id)?.following ?? 0,
      },
      isFollowing: followingIds.has(user.id),
      isFriend: friendIds.includes(user.id),
      friendRequestStatus: friendRequestMap.get(user.id) ?? "NONE",
      canFollow: !user.isPrivate || friendIds.includes(user.id),
      canSendFriendRequest: !friendIds.includes(user.id) && friendRequestMap.get(user.id) === "NONE",
    })),
    posts: visiblePosts,
    hashtags: [...hashtags.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([tag, count]) => ({ tag: "#" + tag, count })),
  });
}
