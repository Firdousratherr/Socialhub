import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";
import { safeDeleteBlob } from "@/lib/blob-cleanup";
import { getActiveUserRestriction } from "@/lib/user-restrictions";
import { platformEnabled } from "@/lib/platform-controls";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"] as const;

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function getAccessibleStory(storyId: string, userId: string) {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      authorId: true,
      audience: true,
      expiresAt: true,
      mediaUrl: true,
      mediaType: true,
      caption: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          isVerified: true,
          isOwner: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          views: true,
          replies: true,
          reactions: true,
        },
      },
    },
  });

  if (!story || !story.author.isActive || story.expiresAt <= new Date()) {
    return { story: null, status: 404 as const };
  }

  if (
    story.authorId !== userId &&
    (await isBlocked(userId, story.authorId))
  ) {
    return { story: null, status: 404 as const };
  }

  if (
    story.authorId !== userId &&
    story.audience === "FRIENDS" &&
    !(await areFriends(userId, story.authorId))
  ) {
    return { story: null, status: 403 as const };
  }

  return { story, status: 200 as const };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { storyId } = await params;
  const access = await getAccessibleStory(storyId, session.user.id);
  if (!access.story) {
    return NextResponse.json(
      { error: access.status === 403 ? "Story unavailable." : "Story not found." },
      { status: access.status },
    );
  }

  const isOwner = access.story.authorId === session.user.id;
  const [replies, reactions, mine] = await Promise.all([
    prisma.storyReply.findMany({
      where: { storyId, ...(isOwner ? {} : { authorId: session.user.id }) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            isVerified: true,
            isOwner: true,
          },
        },
      },
    }),
    prisma.storyReaction.findMany({
      where: { storyId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            isVerified: true,
            isOwner: true,
          },
        },
      },
    }),
    prisma.storyReaction.findUnique({
      where: { storyId_userId: { storyId, userId: session.user.id } },
      select: { id: true, emoji: true },
    }),
  ]);

  const reactionCounts = new Map<string, number>();
  for (const reaction of reactions) {
    reactionCounts.set(
      reaction.emoji,
      (reactionCounts.get(reaction.emoji) ?? 0) + 1,
    );
  }

  const viewers = isOwner
    ? await prisma.storyView.findMany({
        where: { storyId },
        orderBy: [{ viewedAt: "desc" }, { id: "desc" }],
        take: 200,
        include: {
          viewer: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
              isVerified: true,
              isOwner: true,
            },
          },
        },
      })
    : [];

  return NextResponse.json({
    story: {
      id: access.story.id,
      author: access.story.author,
      mediaUrl: access.story.mediaUrl,
      mediaType: access.story.mediaType,
      caption: access.story.caption,
      expiresAt: access.story.expiresAt,
      createdAt: access.story.createdAt,
    },
    isOwner,
    viewCount: access.story._count.views,
    replyCount: access.story._count.replies,
    reactionCount: access.story._count.reactions,
    likeCount: reactionCounts.get("❤️") ?? 0,
    reactionCounts: REACTION_EMOJIS.map((emoji) => ({
      emoji,
      count: reactionCounts.get(emoji) ?? 0,
    })),
    replies,
    reactions: reactions.map((reaction) => ({
      id: reaction.id,
      emoji: reaction.emoji,
      userId: reaction.userId,
      user: reaction.user,
    })),
    myReaction: mine,
    viewers: viewers.map((view) => ({
      id: view.id,
      viewedAt: view.viewedAt,
      viewer: view.viewer,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { storyId } = await params;
  const access = await getAccessibleStory(storyId, session.user.id);
  if (!access.story) {
    return NextResponse.json(
      { error: access.status === 403 ? "Story unavailable." : "Story not found." },
      { status: access.status },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { action?: string; content?: string; emoji?: string }
    | null;

  if (!body?.action) {
    if (access.story.authorId === session.user.id) {
      return NextResponse.json({
        viewed: true,
        viewCount: access.story._count.views,
        alreadyViewed: true,
      });
    }

    const view = await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId, viewerId: session.user.id } },
      create: { storyId, viewerId: session.user.id },
      update: { viewedAt: new Date() },
    });

    const viewCount = await prisma.storyView.count({ where: { storyId } });

    return NextResponse.json({
      viewed: true,
      alreadyViewed: false,
      viewId: view.id,
      viewCount,
    });
  }

  if (body.action === "reply") {
    const commentsEnabled = await platformEnabled("comments", true);
    if (!commentsEnabled) {
      return NextResponse.json(
        { error: "Story replies are temporarily disabled by the platform administrator." },
        { status: 503 },
      );
    }

    if (session.user.id === access.story.authorId) {
      return NextResponse.json(
        { error: "You cannot reply to your own story." },
        { status: 400 },
      );
    }

    const commentRestriction = await getActiveUserRestriction(
      session.user.id,
      "commentingRestrictedUntil",
    );
    if (commentRestriction) {
      return NextResponse.json(
        {
          error: "Story replies are temporarily restricted.",
          restrictedUntil: commentRestriction.toISOString(),
        },
        { status: 403 },
      );
    }

    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 500) {
      return NextResponse.json(
        { error: "Reply must be 1–500 characters." },
        { status: 400 },
      );
    }

    const reply = await prisma.storyReply.create({
      data: {
        storyId,
        authorId: session.user.id,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            isVerified: true,
            isOwner: true,
          },
        },
      },
    });

    const preference = await prisma.notificationPreference.upsert({
      where: { userId: access.story.authorId },
      create: { userId: access.story.authorId },
      update: {},
      select: { storyReplies: true },
    });

    if (preference.storyReplies) {
      await prisma.notification.create({
        data: {
          userId: access.story.authorId,
          actorId: session.user.id,
          type: "STORY_REPLY",
          storyId,
          title: "New story reply",
          body: content,
        },
      });
    }

    return NextResponse.json({ reply, replyCount: access.story._count.replies + 1 }, { status: 201 });
  }

  if (body.action === "reaction") {
    if (session.user.id === access.story.authorId) {
      return NextResponse.json(
        { error: "You cannot react to your own story." },
        { status: 400 },
      );
    }

    const emoji = typeof body.emoji === "string" ? body.emoji : "";
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      return NextResponse.json({ error: "Unsupported reaction." }, { status: 400 });
    }

    const existing = await prisma.storyReaction.findUnique({
      where: { storyId_userId: { storyId, userId: session.user.id } },
      select: { id: true, emoji: true },
    });

    if (existing?.emoji === emoji) {
      return NextResponse.json({
        reaction: existing,
        reactionCount: access.story._count.reactions,
        likeCount: await prisma.storyReaction.count({ where: { storyId, emoji: "❤️" } }),
      });
    }

    const reaction = await prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId, userId: session.user.id } },
      create: { storyId, userId: session.user.id, emoji },
      update: { emoji },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            isVerified: true,
            isOwner: true,
          },
        },
      },
    });

    const reactionCount = await prisma.storyReaction.count({ where: { storyId } });
    const likeCount = await prisma.storyReaction.count({
      where: { storyId, emoji: "❤️" },
    });

    const preference = await prisma.notificationPreference.upsert({
      where: { userId: access.story.authorId },
      create: { userId: access.story.authorId },
      update: {},
      select: { storyReactions: true },
    });

    if (preference.storyReactions) {
      await prisma.notification.create({
        data: {
          userId: access.story.authorId,
          actorId: session.user.id,
          type: "STORY_REACTION",
          storyId,
          title: "New story reaction",
          body: emoji,
        },
      });
    }

    return NextResponse.json({
      reaction,
      reactionCount,
      likeCount,
    });
  }

  return NextResponse.json({ error: "Unsupported story action." }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { storyId } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (body?.action === "reaction") {
    await prisma.storyReaction.deleteMany({
      where: { storyId, userId: session.user.id },
    });
    const reactionCount = await prisma.storyReaction.count({ where: { storyId } });
    const likeCount = await prisma.storyReaction.count({
      where: { storyId, emoji: "❤️" },
    });
    return NextResponse.json({ reaction: null, reactionCount, likeCount });
  }

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true, mediaUrl: true },
  });
  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }
  if (story.authorId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only delete your own story." },
      { status: 403 },
    );
  }

  await prisma.story.delete({ where: { id: storyId } });
  void safeDeleteBlob(story.mediaUrl);
  return NextResponse.json({ success: true });
}
