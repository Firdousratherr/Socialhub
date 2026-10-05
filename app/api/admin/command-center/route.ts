import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission, hasAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

export async function GET(request: Request) {
  const access = await requireAdminPermission("ANALYTICS_VIEW");
  if (access.response) return access.response;

  const canPlatformControl = await hasAdminPermission(access.user.id, access.user.role, "PLATFORM_SETTINGS");
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    usersToday,
    usersWeek,
    postsToday,
    commentsToday,
    messagesToday,
    storiesActive,
    pendingReports,
    criticalReports,
    pendingVerification,
    openCases,
    pendingAppeals,
    activeRestrictions,
    failedAdminLogins,
    expiredSessions,
    recentEvents,
    platformSettings,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.comment.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.story.count({ where: { expiresAt: { gt: now } } }),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "PENDING", priority: "CRITICAL" } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.adminCase.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.adminAppeal.count({ where: { status: "PENDING" } }),
    prisma.user.count({
      where: {
        OR: [
          { postingRestrictedUntil: { gt: now } },
          { commentingRestrictedUntil: { gt: now } },
          { messagingRestrictedUntil: { gt: now } },
          { socialRestrictedUntil: { gt: now } },
          { suspendedUntil: { gt: now } },
        ],
      },
    }),
    prisma.adminLoginAttempt.count({ where: { count: { gt: 0 }, resetAt: { gt: now } } }),
    prisma.session.count({ where: { expiresAt: { lt: now } } }),
    prisma.adminAuditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        resource: true,
        resourceId: true,
        riskLevel: true,
        outcome: true,
        createdAt: true,
      },
    }),
    prisma.systemSetting.findMany({
      where: { key: { in: ["platform.posts.enabled", "platform.comments.enabled", "platform.messaging.enabled", "platform.uploads.enabled", "platform.stories.enabled", "platform.social.enabled", "registration.enabled"] } },
      select: { key: true, value: true, updatedAt: true },
      orderBy: { key: "asc" },
    }),
  ]);

  await recordAdminEvent({
    access,
    request,
    action: "VIEW_COMMAND_CENTER",
    resource: "COMMAND_CENTER",
  });

  return NextResponse.json({
    now: now.toISOString(),
    today: { users: usersToday, posts: postsToday, comments: commentsToday, messages: messagesToday },
    week: { users: usersWeek },
    live: { storiesActive, pendingReports, criticalReports, pendingVerification, openCases, pendingAppeals, activeRestrictions },
    security: { failedAdminLogins, expiredSessions },
    recentEvents,
    platform: Object.fromEntries(platformSettings.map((setting) => [setting.key, { enabled: setting.value.trim().toLowerCase() === "true", updatedAt: setting.updatedAt }])),
    capabilities: { platformControl: canPlatformControl },
  });
}
