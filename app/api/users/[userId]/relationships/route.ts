import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlocked } from "@/lib/social-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, isPrivate: true },
  });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (viewerId && viewerId !== userId && await isBlocked(viewerId, userId)) {
    return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
  }

  const isSelf = viewerId === userId;
  if (!isSelf && target.isPrivate) {
    return NextResponse.json({ followers: [], following: [], mutual: [], hidden: true });
  }

  const [followers, following] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { follower: { select: { id: true, name: true, username: true, image: true, bio: true } } },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { following: { select: { id: true, name: true, username: true, image: true, bio: true } } },
    }),
  ]);

  let mutual: Array<{ id: string; name: string; username: string | null; image: string | null; bio: string | null }> = [];
  if (viewerId && viewerId !== userId) {
    const viewerFollowing = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    const targetFollowerIds = new Set(followers.map((row) => row.follower.id));
    const mutualIds = viewerFollowing.map((row) => row.followingId).filter((id) => targetFollowerIds.has(id)).slice(0, 20);
    if (mutualIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: mutualIds }, isActive: true },
        select: { id: true, name: true, username: true, image: true, bio: true },
      });
      const byId = new Map(users.map((user) => [user.id, user]));
      mutual = mutualIds.map((id) => byId.get(id)).filter(Boolean) as typeof mutual;
    }
  }

  return NextResponse.json({
    hidden: false,
    followers: followers.map((row) => row.follower),
    following: following.map((row) => row.following),
    mutual,
  });
}
