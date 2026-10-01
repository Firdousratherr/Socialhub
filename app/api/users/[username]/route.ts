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
  const visiblePosts = isSelf || friends
    ? user.posts
    : user.posts.filter((post) => {
        // Public posts are always visible; FRIENDS and PRIVATE are filtered below.
        return true;
      });

  return NextResponse.json({
    profile: {
      ...user,
      email: isSelf ? user.email : undefined,
      posts: user.isPrivate && !isSelf && !friends
        ? []
        : visiblePosts.filter((post) => post.visibility === "PUBLIC" || isSelf || friends),
    },
  });
}
