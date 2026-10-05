import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

function scoreBucket(score: number) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

async function calculate(userId: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [reports, posts, comments, messages, follows, friendRequests, activeSignals] = await Promise.all([
    prisma.report.count({ where: { reportedUserId: userId, createdAt: { gte: dayAgo } } }),
    prisma.post.count({ where: { authorId: userId, createdAt: { gte: dayAgo } } }),
    prisma.comment.count({ where: { authorId: userId, createdAt: { gte: dayAgo } } }),
    prisma.message.count({ where: { senderId: userId, createdAt: { gte: dayAgo } } }),
    prisma.follow.count({ where: { followerId: userId, createdAt: { gte: dayAgo } } }),
    prisma.friendRequest.count({ where: { senderId: userId, createdAt: { gte: dayAgo } } }),
    prisma.adminRiskSignal.count({ where: { userId, resolvedAt: null } }),
  ]);
  const score = Math.min(100,
    reports * 18 +
    Math.max(0, posts - 12) * 2 +
    Math.max(0, comments - 40) +
    Math.max(0, messages - 120) / 4 +
    Math.max(0, follows - 80) / 2 +
    Math.max(0, friendRequests - 30) * 2 +
    activeSignals * 5,
  );
  return {
    score: Math.round(score),
    level: scoreBucket(score),
    factors: { reports, posts, comments, messages, follows, friendRequests, activeSignals },
  };
}

export async function GET(request: Request) {
  const access = await requireAdminPermission("RISK_VIEW");
  if (access.response) return access.response;
  const url = new URL(request.url);
  const userId = (url.searchParams.get("userId") ?? "").trim();

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, username: true, image: true, isActive: true, isVerified: true, role: true } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const risk = await calculate(userId);
    const activeSignal = await prisma.adminRiskSignal.findFirst({
      where: { userId, kind: "DYNAMIC_ACTIVITY", resolvedAt: null },
      orderBy: { detectedAt: "desc" },
      select: { id: true, score: true, detectedAt: true },
    });
    await recordAdminEvent({
      access,
      request,
      action: "VIEW_USER_RISK",
      resource: "USER",
      resourceId: userId,
      riskLevel: risk.level as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    });
    return NextResponse.json({ user, risk, signal: activeSignal });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.report.groupBy({
    by: ["reportedUserId"],
    where: { reportedUserId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { reportedUserId: "desc" } },
    take: 50,
  });
  const userIds = rows.map((row) => row.reportedUserId).filter(Boolean) as string[];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true, image: true, isActive: true, isVerified: true, role: true } }) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const risk = rows.map((row) => ({ user: userMap.get(row.reportedUserId!) ?? null, score: Math.min(100, Number(row._count._all) * 18), level: scoreBucket(Number(row._count._all) * 18), reports7d: row._count._all })).filter((row) => row.user);
  await recordAdminEvent({ access, request, action: "VIEW_RISK_QUEUE", resource: "RISK" });
  return NextResponse.json({ risk });
}
