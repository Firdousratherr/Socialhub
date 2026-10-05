import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

const actionSchema = z.object({
  action: z.enum(["UNFOLLOW", "REMOVE_FOLLOWER", "REMOVE_FRIEND", "CANCEL_FRIEND_REQUEST", "REMOVE_BLOCK"]),
  userId: z.string().min(1),
  targetId: z.string().min(1),
});

export async function GET(request: Request) {
  const access = await requireAdminPermission("USERS_VIEW");
  if (access.response) return access.response;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const list = url.searchParams.get("list") ?? "summary";
  if (!userId) return NextResponse.json({ error: "User id is required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, username: true, image: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const personSelect = { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } as const;
  let result: Record<string, unknown> = { user };

  if (list === "followers") {
    const rows = await prisma.follow.findMany({ where: { followingId: userId }, orderBy: { createdAt: "desc" }, take: 100, select: { followerId: true, createdAt: true } });
    const ids = rows.map((row) => row.followerId);
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: personSelect }) : [];
    const map = new Map(people.map((p) => [p.id, p]));
    result.followers = rows.map((r) => ({ ...map.get(r.followerId), createdAt: r.createdAt })).filter((r) => r.id);
  } else if (list === "following") {
    const rows = await prisma.follow.findMany({ where: { followerId: userId }, orderBy: { createdAt: "desc" }, take: 100, select: { followingId: true, createdAt: true } });
    const ids = rows.map((row) => row.followingId);
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: personSelect }) : [];
    const map = new Map(people.map((p) => [p.id, p]));
    result.following = rows.map((r) => ({ ...map.get(r.followingId), createdAt: r.createdAt })).filter((r) => r.id);
  } else if (list === "friends") {
    const rows = await prisma.friendRequest.findMany({ where: { status: "ACCEPTED", OR: [{ senderId: userId }, { receiverId: userId }] }, orderBy: { updatedAt: "desc" }, take: 100, select: { senderId: true, receiverId: true, updatedAt: true } });
    const ids = rows.map((row) => row.senderId === userId ? row.receiverId : row.senderId);
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: personSelect }) : [];
    const map = new Map(people.map((p) => [p.id, p]));
    result.friends = rows.map((r) => ({ ...map.get(r.senderId === userId ? r.receiverId : r.senderId), updatedAt: r.updatedAt })).filter((r) => r.id);
  } else if (list === "blocked") {
    const rows = await prisma.block.findMany({ where: { blockerId: userId }, orderBy: { createdAt: "desc" }, take: 100, select: { blockedId: true, createdAt: true } });
    const ids = rows.map((row) => row.blockedId);
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: personSelect }) : [];
    const map = new Map(people.map((p) => [p.id, p]));
    result.blocked = rows.map((r) => ({ ...map.get(r.blockedId), createdAt: r.createdAt })).filter((r) => r.id);
  } else {
    const [followers, following, friends, pending, blocked] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.friendRequest.count({ where: { status: "ACCEPTED", OR: [{ senderId: userId }, { receiverId: userId }] } }),
      prisma.friendRequest.count({ where: { status: "PENDING", OR: [{ senderId: userId }, { receiverId: userId }] } }),
      prisma.block.count({ where: { blockerId: userId } }),
    ]);
    result.counts = { followers, following, friends, pending, blocked };
  }

  await recordAdminEvent({ access, request, action: "VIEW_SOCIAL_GRAPH", resource: "USER", resourceId: userId, reason: list });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("USERS_EDIT");
  if (access.response) return access.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid relationship action." }, { status: 400 });
  if (parsed.data.userId === parsed.data.targetId) return NextResponse.json({ error: "A user cannot be their own relationship target." }, { status: 400 });

  const { action, userId, targetId } = parsed.data;
  let affected = 0;
  if (action === "UNFOLLOW") {
    affected = (await prisma.follow.deleteMany({ where: { followerId: userId, followingId: targetId } })).count;
  }
  if (action === "REMOVE_FOLLOWER") {
    affected = (await prisma.follow.deleteMany({ where: { followerId: targetId, followingId: userId } })).count;
  }
  if (action === "REMOVE_FRIEND") {
    affected = (await prisma.friendRequest.updateMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
      data: { status: "DECLINED", updatedAt: new Date() },
    })).count;
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId, followingId: targetId }, { followerId: targetId, followingId: userId }] } });
  }
  if (action === "CANCEL_FRIEND_REQUEST") {
    affected = (await prisma.friendRequest.updateMany({
      where: { senderId: userId, receiverId: targetId, status: "PENDING" },
      data: { status: "DECLINED", updatedAt: new Date() },
    })).count;
  }
  if (action === "REMOVE_BLOCK") {
    affected = (await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: targetId } })).count;
  }

  await recordAdminEvent({
    access,
    request,
    action: "SOCIAL_GRAPH_" + action,
    resource: "USER",
    resourceId: userId,
    reason: "Admin relationship operation.",
    riskLevel: "HIGH",
    after: { targetId, affected },
  });
  return NextResponse.json({ success: true, affected });
}
