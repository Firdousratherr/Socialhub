import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ friendId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { friendId } = await params;
  if (friendId === session.user.id) {
    return NextResponse.json({ error: "Invalid friend." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const friendship = await tx.friendRequest.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: session.user.id, receiverId: friendId },
          { senderId: friendId, receiverId: session.user.id },
        ],
      },
      select: { id: true },
    });

    if (!friendship) return false;

    await tx.friendRequest.update({
      where: { id: friendship.id },
      data: { status: "DECLINED", updatedAt: new Date() },
    });

    await tx.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: friendId },
          { followerId: friendId, followingId: session.user.id },
        ],
      },
    });

    return true;
  });

  if (!result) return NextResponse.json({ error: "Friendship not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
