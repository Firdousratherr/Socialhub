import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";
import { safeDeleteBlob } from "@/lib/blob-cleanup";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { storyId } = await params;
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, authorId: true, audience: true, expiresAt: true, author: { select: { isActive: true } } },
  });
  if (!story || !story.author.isActive || story.expiresAt <= new Date()) return NextResponse.json({ error: "Story not found." }, { status: 404 });
  if (story.authorId !== session.user.id && await isBlocked(session.user.id, story.authorId)) return NextResponse.json({ error: "Story unavailable." }, { status: 404 });
  if (story.authorId !== session.user.id && story.audience === "FRIENDS" && !(await areFriends(session.user.id, story.authorId))) return NextResponse.json({ error: "Story unavailable." }, { status: 403 });

  const [replies, reactions, mine] = await Promise.all([
    prisma.storyReply.findMany({
      where: { storyId },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } } },
    }),
    prisma.storyReaction.findMany({
      where: { storyId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, image: true, isVerified: true, isOwner: true } } },
    }),
    prisma.storyReaction.findUnique({ where: { storyId_userId: { storyId, userId: session.user.id } } }),
  ]);

  return NextResponse.json({ replies, reactions, myReaction: mine });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { storyId } = await params;
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, authorId: true, audience: true, expiresAt: true, author: { select: { isActive: true } } },
  });
  if (!story || !story.author.isActive || story.expiresAt <= new Date()) return NextResponse.json({ error: "Story not found." }, { status: 404 });
  if (story.authorId !== session.user.id && await isBlocked(session.user.id, story.authorId)) return NextResponse.json({ error: "Story unavailable." }, { status: 404 });
  if (story.authorId !== session.user.id && story.audience === "FRIENDS" && !(await areFriends(session.user.id, story.authorId))) return NextResponse.json({ error: "Story unavailable." }, { status: 403 });

  const body = await request.json().catch(() => null) as { action?: string; content?: string; emoji?: string } | null;
  if (!body?.action) {
    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId, viewerId: session.user.id } },
      create: { storyId, viewerId: session.user.id },
      update: { viewedAt: new Date() },
    });
    return NextResponse.json({ viewed: true });
  }

  if (body.action === "reply") {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 500) return NextResponse.json({ error: "Reply must be 1–500 characters." }, { status: 400 });
    const reply = await prisma.storyReply.create({
      data: { storyId, authorId: session.user.id, content },
      include: { author: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } } },
    });
    return NextResponse.json({ reply }, { status: 201 });
  }

  if (body.action === "reaction") {
    const emoji = typeof body.emoji === "string" ? body.emoji : "";
    if (!["❤️","😂","😮","😢","🔥","👍"].includes(emoji)) return NextResponse.json({ error: "Unsupported reaction." }, { status: 400 });
    const reaction = await prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId, userId: session.user.id } },
      create: { storyId, userId: session.user.id, emoji },
      update: { emoji },
      include: { user: { select: { id: true, name: true, image: true, isVerified: true, isOwner: true } } },
    });
    return NextResponse.json({ reaction });
  }

  return NextResponse.json({ error: "Unsupported story action." }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { storyId } = await params;
  const body = await _request.json().catch(() => null) as { action?: string } | null;
  if (body?.action === "reaction") {
    await prisma.storyReaction.deleteMany({ where: { storyId, userId: session.user.id } });
    return NextResponse.json({ reaction: null });
  }
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true, mediaUrl: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
  if (story.authorId !== session.user.id) return NextResponse.json({ error: "You can only delete your own story." }, { status: 403 });

  await prisma.story.delete({ where: { id: storyId } });
  void safeDeleteBlob(story.mediaUrl);
  return NextResponse.json({ success: true });
}
