import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const actionSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { requestId } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request action." }, { status: 400 });

  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });

  if (!friendRequest || friendRequest.receiverId !== session.user.id) {
    return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.friendRequest.update({
      where: { id: requestId },
      data: { status: parsed.data.status, updatedAt: new Date() },
    });

    if (parsed.data.status === "ACCEPTED") {
      await tx.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: friendRequest.senderId,
            followingId: friendRequest.receiverId,
          },
        },
        update: {},
        create: {
          followerId: friendRequest.senderId,
          followingId: friendRequest.receiverId,
        },
      });
      await tx.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: friendRequest.receiverId,
            followingId: friendRequest.senderId,
          },
        },
        update: {},
        create: {
          followerId: friendRequest.receiverId,
          followingId: friendRequest.senderId,
        },
      });
      await tx.notification.create({
        data: {
          userId: friendRequest.senderId,
          actorId: session.user.id,
          type: "FRIEND_ACCEPTED",
        },
      });
    }

    return next;
  });

  return NextResponse.json({ friendRequest: updated });
}
