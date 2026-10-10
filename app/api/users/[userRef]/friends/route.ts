import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, isBlocked } from "@/lib/social-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userRef: string }> },
) {
  const { userRef: userId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isPrivate: true, isActive: true, privacySetting: { select: { showFriendsList: true } } },
  });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const viewerId = session?.user?.id;
  const isSelf = viewerId === userId;
  if (viewerId && !isSelf && await isBlocked(viewerId, userId)) {
    return NextResponse.json({ error: "This profile is unavailable." }, { status: 404 });
  }

  if (!isSelf && target.privacySetting && !target.privacySetting.showFriendsList) {
    return NextResponse.json({ friends: [], hidden: true });
  }
  if (!isSelf && target.isPrivate && (!viewerId || !(await areFriends(viewerId, userId)))) {
    return NextResponse.json({ friends: [], hidden: true });
  }

  const requests = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      sender: { select: { id: true, name: true, username: true, image: true, bio: true, isVerified: true, isOwner: true } },
      receiver: { select: { id: true, name: true, username: true, image: true, bio: true, isVerified: true, isOwner: true } },
    },
  });

  const friends = requests.map((request) =>
    request.senderId === userId ? request.receiver : request.sender,
  );

  return NextResponse.json({ friends, hidden: false });
}
