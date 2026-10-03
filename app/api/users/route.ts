import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIds } from "@/lib/social-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const suggestionsMode = url.searchParams.get("suggestions") === "true";
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 20), 1), 50);
  const candidateTake = suggestionsMode && q.length === 0 ? Math.min(take * 4, 100) : take;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id;
  const blockedIds = viewerId ? await getBlockedUserIds(viewerId) : [];

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(viewerId ? { id: { notIn: [viewerId, ...blockedIds] } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: candidateTake,
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      isPrivate: true,
      isVerified: true,
      isOwner: true,
      _count: { select: { followers: true, following: true } },
    },
  });

  if (!viewerId) {
    return NextResponse.json({ users: suggestionsMode ? users.slice(0, take) : users });
  }

  const userIds = users.map((user) => user.id);
  const [followingRows, friendRows, pendingRows, metricOverrides] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: userIds } },
      select: { followingId: true },
    }),
    prisma.friendRequest.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: viewerId, receiverId: { in: userIds } },
          { receiverId: viewerId, senderId: { in: userIds } },
        ],
      },
      select: { senderId: true, receiverId: true },
    }),
    prisma.friendRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          { senderId: viewerId, receiverId: { in: userIds } },
          { receiverId: viewerId, senderId: { in: userIds } },
        ],
      },
      select: { id: true, senderId: true, receiverId: true },
    }),
    prisma.adminMetricOverride.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, posts: true, followers: true, following: true },
    }),
  ]);

  const followingIds = new Set(followingRows.map((row) => row.followingId));
  const friendIds = new Set(friendRows.map((row) =>
    row.senderId === viewerId ? row.receiverId : row.senderId,
  ));
  const metricByUser = new Map(metricOverrides.map((row) => [row.userId, row]));
  const pendingByUser = new Map();
  for (const row of pendingRows) {
    const otherId = row.senderId === viewerId ? row.receiverId : row.senderId;
    pendingByUser.set(otherId, {
      id: row.id,
      status: row.senderId === viewerId ? "OUTGOING_PENDING" : "INCOMING_PENDING",
    });
  }

  const relationshipAwareUsers = users.map((user) => {
    const pending = pendingByUser.get(user.id);
    return {
      ...user,
      displayCounts: {
        posts: metricByUser.get(user.id)?.posts ?? user._count.posts,
        followers: metricByUser.get(user.id)?.followers ?? user._count.followers,
        following: metricByUser.get(user.id)?.following ?? user._count.following,
      },
      isFollowing: followingIds.has(user.id),
      isFriend: friendIds.has(user.id),
      friendRequestStatus: pending?.status ?? "NONE",
      friendRequestId: pending?.id ?? null,
      canFollow: !user.isPrivate || friendIds.has(user.id),
      canSendFriendRequest: !friendIds.has(user.id) && !pending,
    };
  });

  const visibleUsers = suggestionsMode
    ? relationshipAwareUsers.filter((user) =>
        !user.isFollowing &&
        !user.isFriend &&
        user.friendRequestStatus === "NONE",
      ).slice(0, take)
    : relationshipAwareUsers;

  return NextResponse.json({ users: visibleUsers });
}
