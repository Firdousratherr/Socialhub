import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

export async function GET(request: Request) {
  const access = await requireAdminPermission("DATA_INTEGRITY");
  if (access.response) return access.response;
  const now = new Date();

  const [expiredSessions, expiredStories, inactiveModerators, orphanOverrides, pendingReportsWithMissingTargets] = await Promise.all([
    prisma.session.count({ where: { expiresAt: { lt: now } } }),
    prisma.story.count({ where: { expiresAt: { lt: now } } }),
    prisma.user.count({ where: { role: "MODERATOR", isActive: true, adminPermissions: { none: {} } } }),
    prisma.adminMetricOverride.count({ where: { user: { isActive: false } } }),
    prisma.report.count({
      where: {
        status: "PENDING",
        AND: [
          { postId: { not: null } },
          { post: null },
        ],
      },
    }).catch(() => 0),
  ]);

  const issues = [
    { key: "expired_sessions", severity: "LOW", count: expiredSessions, fix: "CLEAN_EXPIRED_SESSIONS" },
    { key: "expired_stories", severity: "LOW", count: expiredStories, fix: "CLEAN_EXPIRED_STORIES" },
    { key: "active_moderators_without_permissions", severity: "HIGH", count: inactiveModerators, fix: null },
    { key: "inactive_user_metric_overrides", severity: "LOW", count: orphanOverrides, fix: "CLEAN_INACTIVE_OVERRIDES" },
    { key: "pending_reports_with_missing_targets", severity: "MEDIUM", count: pendingReportsWithMissingTargets, fix: "CLEAN_DANGLING_REPORTS" },
  ];

  await recordAdminEvent({ access, request, action: "RUN_DATA_INTEGRITY_SCAN", resource: "INTEGRITY" });
  return NextResponse.json({ scannedAt: now.toISOString(), issues, totalIssues: issues.reduce((sum, item) => sum + item.count, 0) });
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("DATA_INTEGRITY");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!["CLEAN_EXPIRED_SESSIONS", "CLEAN_EXPIRED_STORIES", "CLEAN_INACTIVE_OVERRIDES", "CLEAN_DANGLING_REPORTS"].includes(action)) {
    return NextResponse.json({ error: "Unsupported integrity repair." }, { status: 400 });
  }

  let count = 0;
  if (action === "CLEAN_EXPIRED_SESSIONS") count = (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
  if (action === "CLEAN_EXPIRED_STORIES") count = (await prisma.story.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
  if (action === "CLEAN_INACTIVE_OVERRIDES") count = (await prisma.adminMetricOverride.deleteMany({ where: { user: { isActive: false } } })).count;
  if (action === "CLEAN_DANGLING_REPORTS") {
    const pending = await prisma.report.findMany({
      where: { status: "PENDING" },
      select: { id: true, postId: true, commentId: true, reportedUserId: true, post: { select: { id: true } }, comment: { select: { id: true } }, reportedUser: { select: { id: true } } },
      take: 5000,
    });
    const danglingIds = pending.filter((row) =>
      (row.postId && !row.post) ||
      (row.commentId && !row.comment) ||
      (row.reportedUserId && !row.reportedUser)
    ).map((row) => row.id);
    if (danglingIds.length) {
      count = (await prisma.report.updateMany({
        where: { id: { in: danglingIds } },
        data: { status: "DISMISSED", moderatorNote: "Automatically dismissed during integrity repair because the reported target no longer exists." },
      })).count;
    }
  }

  await recordAdminEvent({ access, request, action: "INTEGRITY_" + action, resource: "INTEGRITY", riskLevel: "HIGH", after: { count } });
  return NextResponse.json({ success: true, count });
}
