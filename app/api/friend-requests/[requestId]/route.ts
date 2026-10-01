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

  const updated = await prisma.$transaction(async (tx) => {
    const friendRequest = await tx.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: session.user.id,
        status: "PENDING",
      },
    });

    if (!friendRequest) return null;

    if (parsed.data.status === "ACCEPTED") {
      const block = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: friendRequest.senderId, blockedId: friendRequest.receiverId },
            { blockerId: friendRequest.receiverId, blockedId: friendRequest.senderId },
          ],
        },
        select: { blockerId: true },
      });

      if (block) return { blocked: true as const };
    }

    const claimed = await tx.friendRequest.updateMany({
      where: {
        id: requestId,
        receiverId: session.user.id,
        status: "PENDING",
      },
      data: {
        status: parsed.data.status,
        updatedAt: new Date(),
      },
    });

    if (claimed.count !== 1) return null;

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

    return { blocked: false as const, status: parsed.data.status };
  });

  if (!updated) {
    return NextResponse.json({ error: "Friend request is no longer pending." }, { status: 409 });
  }

  if (updated.blocked) {
    return NextResponse.json({ error: "The relationship is blocked and cannot be accepted." }, { status: 403 });
  }

  return NextResponse.json({
    friendRequest: {
      id: requestId,
      status: updated.status,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { requestId } = await params;
  const result = await prisma.friendRequest.updateMany({
    where: { id: requestId, senderId: session.user.id, status: "PENDING" },
    data: { status: "DECLINED", updatedAt: new Date() },
  });

  if (!result.count) return NextResponse.json({ error: "Sent request not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
