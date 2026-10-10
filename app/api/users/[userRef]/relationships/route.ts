import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlocked } from "@/lib/social-access";

function decodeCursor(value: string | null) {
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
    if (!payload.createdAt || !payload.id) return null;
    const createdAt = new Date(payload.createdAt);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: payload.id };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

const personSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
  bio: true,
  isVerified: true,
  isOwner: true,
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userRef: string }> },
) {
  const { userRef: userId } = await params;
  const url = new URL(request.url);
  const list = url.searchParams.get("list");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
  const before = decodeCursor(url.searchParams.get("before"));
  if (url.searchParams.get("before") && !before) {
    return NextResponse.json({ error: "Invalid relationship cursor." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      isPrivate: true,
      privacySetting: {
        select: { showFriendsList: true, showFollowersList: true, showFollowingList: true },
      },
    },
  });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (viewerId && viewerId !== userId && await isBlocked(viewerId, userId)) {
    return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
  }

  const isSelf = viewerId === userId;
  if (!isSelf && target.isPrivate) {
    const canSeePrivateRelationships = viewerId
      ? await prisma.friendRequest.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { senderId: viewerId, receiverId: userId },
              { senderId: userId, receiverId: viewerId },
            ],
          },
          select: { id: true },
        })
      : null;
    if (!canSeePrivateRelationships) {
      return NextResponse.json({
        followers: [],
        following: [],
        mutual: [],
        hidden: true,
        followersHidden: true,
        followingHidden: true,
        mutualHidden: true,
      });
    }
  }

  if (list === "followers" || list === "following") {
    const isFollowers = list === "followers";
    const listIsHidden = isFollowers
      ? !isSelf && target.privacySetting?.showFollowersList === false
      : !isSelf && target.privacySetting?.showFollowingList === false;
    if (listIsHidden) {
      return NextResponse.json({ followers: [], following: [], mutual: [], hidden: false, nextBefore: null });
    }

    if (isFollowers) {
      const rows = await prisma.follow.findMany({
        where: {
          followingId: userId,
          ...(before ? {
            OR: [
              { createdAt: { lt: before.createdAt } },
              { createdAt: before.createdAt, followerId: { lt: before.id } },
            ],
          } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
        take: take + 1,
        select: { createdAt: true, follower: { select: personSelect } },
      });
      const hasMore = rows.length > take;
      const page = rows.slice(0, take);
      const last = page.at(-1);
      return NextResponse.json({
        hidden: false,
        followers: page.map((row) => row.follower),
        following: [],
        mutual: [],
        nextBefore: hasMore && last ? encodeCursor(last.createdAt, last.follower.id) : null,
      });
    }

    const rows = await prisma.follow.findMany({
      where: {
        followerId: userId,
        ...(before ? {
          OR: [
            { createdAt: { lt: before.createdAt } },
            { createdAt: before.createdAt, followingId: { lt: before.id } },
          ],
        } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { followingId: "desc" }],
      take: take + 1,
      select: { createdAt: true, following: { select: personSelect } },
    });
    const hasMore = rows.length > take;
    const page = rows.slice(0, take);
    const last = page.at(-1);
    return NextResponse.json({
      hidden: false,
      followers: [],
      following: page.map((row) => row.following),
      mutual: [],
      nextBefore: hasMore && last ? encodeCursor(last.createdAt, last.following.id) : null,
    });
  }

  const [followersRows, followingRows] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
      take: take + 1,
      select: { createdAt: true, follower: { select: personSelect } },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: [{ createdAt: "desc" }, { followingId: "desc" }],
      take: take + 1,
      select: { createdAt: true, following: { select: personSelect } },
    }),
  ]);

  let mutual: Array<{ id: string; name: string; username: string | null; image: string | null; bio: string | null; isVerified: boolean; isOwner: boolean }> = [];
  if (viewerId && viewerId !== userId) {
    const [viewerFriendships, targetFriendships] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { status: "ACCEPTED", OR: [{ senderId: viewerId }, { receiverId: viewerId }] },
        select: { senderId: true, receiverId: true },
      }),
      prisma.friendRequest.findMany({
        where: { status: "ACCEPTED", OR: [{ senderId: userId }, { receiverId: userId }] },
        select: { senderId: true, receiverId: true },
      }),
    ]);
    const friendIds = (rows: typeof viewerFriendships, ownId: string) =>
      new Set(rows.map((row) => row.senderId === ownId ? row.receiverId : row.senderId));
    const viewerFriendIds = friendIds(viewerFriendships, viewerId);
    const targetFriendIds = friendIds(targetFriendships, userId);
    const mutualIds = Array.from(viewerFriendIds).filter((id) => targetFriendIds.has(id)).slice(0, 20);
    if (mutualIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: mutualIds }, isActive: true },
        select: personSelect,
      });
      const byId = new Map(users.map((user) => [user.id, user]));
      mutual = mutualIds.map((id) => byId.get(id)).filter(Boolean) as typeof mutual;
    }
  }

  const followerPage = followersRows.slice(0, take);
  const followingPage = followingRows.slice(0, take);
  return NextResponse.json({
    hidden: false,
    followers: isSelf || target.privacySetting?.showFollowersList !== false ? followerPage.map((row) => row.follower) : [],
    following: isSelf || target.privacySetting?.showFollowingList !== false ? followingPage.map((row) => row.following) : [],
    mutual: isSelf || target.privacySetting?.showFriendsList !== false ? mutual : [],
    followersHidden: !isSelf && target.privacySetting?.showFollowersList === false,
    followingHidden: !isSelf && target.privacySetting?.showFollowingList === false,
    mutualHidden: !isSelf && target.privacySetting?.showFriendsList === false,
    nextFollowersBefore: followerPage.length < followersRows.length && followerPage.length ? encodeCursor(followerPage.at(-1)!.createdAt, followerPage.at(-1)!.follower.id) : null,
    nextFollowingBefore: followingPage.length < followingRows.length && followingPage.length ? encodeCursor(followingPage.at(-1)!.createdAt, followingPage.at(-1)!.following.id) : null,
  });
}
