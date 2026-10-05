import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

export async function GET(request: Request) {
  const access = await requireAdminPermission("ANALYTICS_VIEW");
  if (access.response) return access.response;
  const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    newUsers7d,
    verifiedUsers,
    reportedUsers7d,
    usersWithoutPosts,
    usersWithoutMessages,
    moderators,
    privateProfiles,
    activeToday,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: sevenDays } } }),
    prisma.user.count({ where: { isVerified: true, isOwner: false } }),
    prisma.user.count({ where: { reportedIn: { some: { createdAt: { gte: sevenDays } } } } }),
    prisma.user.count({ where: { posts: { none: {} }, isActive: true } }),
    prisma.user.count({ where: { sentMessages: { none: {} }, isActive: true } }),
    prisma.user.count({ where: { role: "MODERATOR", isActive: true } }),
    prisma.user.count({ where: { isPrivate: true, isActive: true } }),
    prisma.user.count({ where: { updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, isActive: true } }),
  ]);

  await recordAdminEvent({ access, request, action: "VIEW_USER_SEGMENTS", resource: "SEGMENT" });

  return NextResponse.json({
    segments: [
      { key: "new_users_7d", label: "New users · 7 days", count: newUsers7d, description: "Accounts created during the last seven days." },
      { key: "verified", label: "Verified accounts", count: verifiedUsers, description: "Accounts with a public verification badge." },
      { key: "reported_7d", label: "Reported · 7 days", count: reportedUsers7d, description: "Accounts appearing as report targets during the last seven days." },
      { key: "no_posts", label: "No posts", count: usersWithoutPosts, description: "Active accounts without any post." },
      { key: "no_messages", label: "No messages", count: usersWithoutMessages, description: "Active accounts that have never sent a message." },
      { key: "moderators", label: "Moderators", count: moderators, description: "Active moderator accounts." },
      { key: "private_profiles", label: "Private profiles", count: privateProfiles, description: "Active accounts with private profiles." },
      { key: "active_24h", label: "Active signal · 24h", count: activeToday, description: "Accounts updated during the last 24 hours; a rough activity proxy." },
    ],
    generatedAt: new Date().toISOString(),
    range: { sevenDays: sevenDays.toISOString(), thirtyDays: thirtyDays.toISOString() },
  });
}
