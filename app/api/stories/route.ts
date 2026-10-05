import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storyInputSchema } from "@/lib/validation";
import { getBlockedUserIds } from "@/lib/social-access";
import { getActiveUserRestriction } from "@/lib/user-restrictions";
import { platformEnabled } from "@/lib/platform-controls";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const now = new Date();
  const session = await getSession();

  let friendIds: string[] = [];
  let blockedIds: string[] = [];

  if (session?.user) {
    blockedIds = await getBlockedUserIds(session.user.id);
    friendIds = (
      await prisma.friendRequest.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: session.user.id },
            { receiverId: session.user.id },
          ],
        },
        select: { senderId: true, receiverId: true },
      })
    ).map((row) => (row.senderId === session.user.id ? row.receiverId : row.senderId));
  }

  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: now },
      author: {
        isActive: true,
        ...(blockedIds.length ? { id: { notIn: blockedIds } } : {}),
      },
      ...(session?.user
        ? {
            OR: [
              { audience: "PUBLIC" },
              { authorId: session.user.id },
              ...(friendIds.length ? [{ audience: "FRIENDS" as const, authorId: { in: friendIds } }] : []),
            ],
          }
        : { audience: "PUBLIC" }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });

  const viewedIds = session?.user
    ? new Set(
        (
          await prisma.storyView.findMany({
            where: { viewerId: session.user.id, storyId: { in: stories.map((story) => story.id) } },
            select: { storyId: true },
          })
        ).map((view) => view.storyId),
      )
    : new Set<string>();

  return NextResponse.json({
    stories: stories.map((story) => ({ ...story, hasViewed: viewedIds.has(story.id) })),
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const storiesEnabled = await platformEnabled("stories", true);
  if (!storiesEnabled) return NextResponse.json({ error: "Stories are temporarily disabled by the platform administrator." }, { status: 503 });
  const parsed = storyInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid story." },
      { status: 400 },
    );
  }

  const now = new Date();
  const maxExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (parsed.data.expiresAt <= now) {
    return NextResponse.json({ error: "Story expiry must be in the future." }, { status: 400 });
  }

  if (parsed.data.expiresAt > maxExpiry) {
    return NextResponse.json({ error: "Stories can expire at most 24 hours after creation." }, { status: 400 });
  }

  const storyRestriction = await getActiveUserRestriction(session.user.id, "postingRestrictedUntil");
  if (storyRestriction) {
    return NextResponse.json({ error: "Story creation is temporarily restricted.", restrictedUntil: storyRestriction.toISOString() }, { status: 403 });
  }

  const story = await prisma.story.create({
    data: {
      authorId: session.user.id,
      mediaUrl: parsed.data.mediaUrl,
      caption: parsed.data.caption ?? null,
      audience: parsed.data.audience,
      expiresAt: parsed.data.expiresAt,
    },
    include: {
      author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });

  return NextResponse.json({ story }, { status: 201 });
}
