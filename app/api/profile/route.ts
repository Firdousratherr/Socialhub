import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileInputSchema } from "@/lib/validation";
import { safeDeleteBlob } from "@/lib/blob-cleanup";
import { getPostDisplayCountsMap } from "@/lib/post-metrics";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, username: true, bio: true,
      image: true, coverImage: true, website: true, location: true,
      isPrivate: true, role: true, isVerified: true, isOwner: true, verifiedAt: true, ownerSince: true, createdAt: true,
      _count: { select: { posts: true, followers: true, following: true } },
      posts: {
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          content: true,
          mediaUrl: true,
          visibility: true,
          isPinned: true,
          createdAt: true,
          _count: { select: { likes: true, comments: true } },
        },
      },
    },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const [override, likesReceived, commentsReceived, shares, profileViews] = await Promise.all([
    prisma.adminMetricOverride.findUnique({ where: { userId: profile.id } }),
    prisma.like.count({ where: { post: { authorId: profile.id } } }),
    prisma.comment.count({ where: { post: { authorId: profile.id } } }),
    prisma.post.aggregate({ where: { authorId: profile.id }, _sum: { shareCount: true } }),
    prisma.profileView.count({ where: { profileId: profile.id } }),
  ]);

  const postDisplayCounts = await getPostDisplayCountsMap(profile.posts.map((post) => post.id));
  const visiblePosts = profile.posts.map((post) => {
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
      ...profile,
      posts: visiblePosts,
      visibleCounts: {
        posts: override?.posts ?? profile._count.posts,
        followers: override?.followers ?? profile._count.followers,
        following: override?.following ?? profile._count.following,
        likesReceived: override?.likesReceived ?? likesReceived,
        commentsReceived: override?.commentsReceived ?? commentsReceived,
        shares: override?.shares ?? (shares._sum.shareCount ?? 0),
        profileViews: override?.profileViews ?? profileViews,
      },
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = profileInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile data." },
      { status: 400 },
    );
  }

  const previousMedia = await prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true, coverImage: true } });

  try {
    const profile = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        id: true, name: true, email: true, username: true, bio: true,
        image: true, coverImage: true, website: true, location: true,
        isPrivate: true, role: true, isVerified: true, isOwner: true, verifiedAt: true, ownerSince: true,
      },
    });

    if (previousMedia?.image && previousMedia.image !== profile.image) void safeDeleteBlob(previousMedia.image);
    if (previousMedia?.coverImage && previousMedia.coverImage !== profile.coverImage) void safeDeleteBlob(previousMedia.coverImage);
    return NextResponse.json({ profile });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    }

    throw error;
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOwner: true } });
  if (current?.isOwner) {
    return NextResponse.json({ error: "The Socialhub owner account cannot be deleted from the standard account flow." }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { isActive: false, deletedAt: new Date(), suspensionReason: "Account deletion requested." },
    }),
    prisma.session.deleteMany({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ success: true });
}
