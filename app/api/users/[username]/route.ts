import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";
import { getPostDisplayCountsMap } from "@/lib/post-metrics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, name: true, username: true, email: true, bio: true, image: true,
      coverImage: true, website: true, location: true, isPrivate: true, isVerified: true, isOwner: true, verifiedAt: true, ownerSince: true, createdAt: true,
      privacySetting: { select: { allowMessagesEveryone: true, allowFriendRequests: true } },
      _count: { select: { posts: true, followers: true, following: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const isSelf = session?.user?.id === user.id;
  if (!isSelf && session?.user) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentView = await prisma.profileView.findFirst({
      where: { profileId: user.id, viewerId: session.user.id, viewedAt: { gte: since } },
      select: { id: true },
    });
    if (!recentView) {
      await prisma.profileView.create({ data: { profileId: user.id, viewerId: session.user.id } });
    }
  }
  if (!isSelf && session?.user && await isBlocked(session.user.id, user.id)) {
    return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
  }

  const [override, actualLikesReceived, actualCommentsReceived, actualShares, actualProfileViews] = await Promise.all([
    prisma.adminMetricOverride.findUnique({ where: { userId: user.id } }),
    prisma.like.count({ where: { post: { authorId: user.id } } }),
    prisma.comment.count({ where: { post: { authorId: user.id } } }),
    prisma.post.aggregate({ where: { authorId: user.id }, _sum: { shareCount: true } }),
    prisma.profileView.count({ where: { profileId: user.id } }),
  ]);

  const friends = Boolean(session?.user && await areFriends(session.user.id, user.id));
  const [acceptedFriendship, pendingFriendRequest] = session?.user && !isSelf
    ? await Promise.all([
        prisma.friendRequest.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { senderId: session.user.id, receiverId: user.id },
              { senderId: user.id, receiverId: session.user.id },
            ],
          },
          select: { id: true },
        }),
        prisma.friendRequest.findFirst({
          where: {
            status: "PENDING",
            OR: [
              { senderId: session.user.id, receiverId: user.id },
              { senderId: user.id, receiverId: session.user.id },
            ],
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, senderId: true, receiverId: true },
        }),
      ])
    : [null, null] as const;
  const friendRequestStatus = isSelf
    ? "SELF"
    : acceptedFriendship
      ? "FRIENDS"
      : pendingFriendRequest?.senderId === session?.user?.id
        ? "OUTGOING_PENDING"
        : pendingFriendRequest
          ? "INCOMING_PENDING"
          : "NONE";
  const following = Boolean(
    session?.user &&
      await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } },
        select: { followerId: true },
      }),
  );

  const canSeeFriendsPosts = isSelf || friends;
  const { privacySetting, ...safeUser } = user;
  const canMessage = !isSelf && (!privacySetting || privacySetting.allowMessagesEveryone || friends);
  const posts = await prisma.post.findMany({
    where: {
      authorId: user.id,
      OR: [
        { visibility: "PUBLIC" },
        ...(canSeeFriendsPosts ? [{ visibility: "FRIENDS" as const }] : []),
        ...(isSelf ? [{ visibility: "PRIVATE" as const }] : []),
      ],
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true, content: true, mediaUrl: true, visibility: true, isPinned: true, createdAt: true,
      _count: { select: { likes: true, comments: true } },
    },
  });

  const postDisplayCounts = await getPostDisplayCountsMap(posts.map((post) => post.id));
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
    profile: {
      ...safeUser,
      email: isSelf ? safeUser.email : undefined,
      posts: user.isPrivate && !isSelf && !friends ? [] : visiblePosts,
      isFollowing: following,
      isFriend: friends,
      friendRequestStatus,
      friendRequestId: pendingFriendRequest?.id ?? null,
      canMessage,
      canSendFriendRequest: !isSelf && (!user.privacySetting || user.privacySetting.allowFriendRequests),
      canFollow: !isSelf && (!user.isPrivate || friends),
      visibleCounts: {
        posts: override?.posts ?? user._count.posts,
        followers: override?.followers ?? user._count.followers,
        following: override?.following ?? user._count.following,
        likesReceived: override?.likesReceived ?? actualLikesReceived,
        commentsReceived: override?.commentsReceived ?? actualCommentsReceived,
        shares: override?.shares ?? (actualShares._sum.shareCount ?? 0),
        profileViews: override?.profileViews ?? actualProfileViews,
      },
    },
  });
}
