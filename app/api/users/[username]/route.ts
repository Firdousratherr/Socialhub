import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      bio: true,
      image: true,
      coverImage: true,
      website: true,
      location: true,
      isPrivate: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
      posts: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          content: true,
          mediaUrl: true,
          createdAt: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const isSelf = session?.user?.id === user.id;
  if (!isSelf && session?.user && await isBlocked(session.user.id, user.id)) {
    return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
  }

  const friends = Boolean(session?.user && await areFriends(session.user.id, user.id));
  const following = Boolean(
    session?.user &&
      await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } },
        select: { followerId: true },
      }),
  );
  const visiblePosts = user.posts;

  return NextResponse.json({
    profile: {
      ...user,
      email: isSelf ? user.email : undefined,
      posts: user.isPrivate && !isSelf && !friends
        ? []
        : visiblePosts.filter((post) => post.visibility === "PUBLIC" || isSelf || friends),
      isFollowing: following,
      isFriend: friends,
    },
  });
}
