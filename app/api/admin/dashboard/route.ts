import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET() {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const [users, activeUsers, verifiedUsers, ownerUsers, pendingVerificationRequests, posts, likes, comments, follows, messages, stories, pendingReports, recentUsers, recentPosts, recentAudit] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isVerified: true, isOwner: false } }),
      prisma.user.count({ where: { isOwner: true } }),
      prisma.verificationRequest.count({ where: { status: "PENDING" } }),
      prisma.post.count(),
      prisma.like.count(),
      prisma.comment.count(),
      prisma.follow.count(),
      prisma.message.count(),
      prisma.story.count(),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, username: true, createdAt: true, isActive: true, role: true } }),
      prisma.post.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, content: true, createdAt: true, author: { select: { name: true, username: true } }, _count: { select: { likes: true, comments: true } } } }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

  return NextResponse.json({
    stats: { users, activeUsers, verifiedUsers, ownerUsers, pendingVerificationRequests, posts, likes, comments, follows, messages, stories, pendingReports },
    recentUsers,
    recentPosts,
    recentAudit,
  });
}
