import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { friendRequestInputSchema } from "@/lib/validation";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [received, sent] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { receiverId: session.user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, username: true, image: true } },
      },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: session.user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        receiver: { select: { id: true, name: true, username: true, image: true } },
      },
    }),
  ]);

  return NextResponse.json({ received, sent });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = friendRequestInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid friend request." }, { status: 400 });

  const { receiverId } = parsed.data;
  if (receiverId === session.user.id) {
    return NextResponse.json({ error: "You cannot send yourself a friend request." }, { status: 400 });
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, isActive: true },
  });
  if (!receiver?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const requestRecord = await prisma.friendRequest.findUnique({
    where: {
      senderId_receiverId: {
        senderId: session.user.id,
        receiverId,
      },
    },
  });

  if (requestRecord?.status === "PENDING") {
    return NextResponse.json({ error: "Friend request already pending." }, { status: 409 });
  }

  const friendRequest = requestRecord
    ? await prisma.friendRequest.update({
        where: { id: requestRecord.id },
        data: { status: "PENDING", updatedAt: new Date() },
      })
    : await prisma.friendRequest.create({
        data: { senderId: session.user.id, receiverId },
      });

  await prisma.notification.create({
    data: {
      userId: receiverId,
      actorId: session.user.id,
      type: "FRIEND_REQUEST",
    },
  });

  return NextResponse.json({ friendRequest }, { status: 201 });
}
