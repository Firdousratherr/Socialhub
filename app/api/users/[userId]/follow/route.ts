import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlocked } from "@/lib/social-access";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  if (await isBlocked(session.user.id, userId)) {
    return NextResponse.json({ error: "You cannot follow this user while a block is active." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, isPrivate: true },
  });
  if (!target || !target.isActive) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.isPrivate) {
    return NextResponse.json(
      { error: "This account is private. Send a friend request instead." },
      { status: 403 },
    );
  }

  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: userId,
      },
    },
    update: {},
    create: {
      followerId: session.user.id,
      followingId: userId,
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      actorId: session.user.id,
      type: "FOLLOW",
    },
  });

  return NextResponse.json({ following: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { userId } = await params;
  await prisma.follow.deleteMany({
    where: {
      followerId: session.user.id,
      followingId: userId,
    },
  });

  return NextResponse.json({ following: false });
}
