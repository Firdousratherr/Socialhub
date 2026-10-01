import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { userId } = await params;
  if (userId === session.user.id) return NextResponse.json({ error: "You cannot block yourself." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: userId } },
    update: {},
    create: { blockerId: session.user.id, blockedId: userId },
  });

  await prisma.$transaction([
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: userId },
          { followerId: userId, followingId: session.user.id },
        ],
      },
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: userId },
          { senderId: userId, receiverId: session.user.id },
        ],
      },
    }),
  ]);

  return NextResponse.json({ blocked: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { userId } = await params;
  await prisma.block.deleteMany({
    where: { blockerId: session.user.id, blockedId: userId },
  });

  return NextResponse.json({ blocked: false });
}
