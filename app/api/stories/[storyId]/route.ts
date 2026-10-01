import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
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
  if (!story || !story.author.isActive || story.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }
  if (story.authorId !== session.user.id && await isBlocked(session.user.id, story.authorId)) {
    return NextResponse.json({ error: "Story unavailable." }, { status: 404 });
  }
  if (story.authorId !== session.user.id && story.audience === "FRIENDS" && !(await areFriends(session.user.id, story.authorId))) {
    return NextResponse.json({ error: "Story unavailable." }, { status: 403 });
  }

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId, viewerId: session.user.id } },
    create: { storyId, viewerId: session.user.id },
    update: { viewedAt: new Date() },
  });

  return NextResponse.json({ viewed: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { storyId } = await params;
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
  if (story.authorId !== session.user.id) return NextResponse.json({ error: "You can only delete your own story." }, { status: 403 });

  await prisma.story.delete({ where: { id: storyId } });
  return NextResponse.json({ success: true });
}
