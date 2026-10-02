import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET() {
  const access = await requireAdminPermission("ANALYTICS_VIEW");
  if (access.response) return access.response;

  const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const [users, posts, messages, reports, profileViews] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count FROM "User" WHERE "createdAt" >= ${start} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count FROM "Post" WHERE "createdAt" >= ${start} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count FROM "Message" WHERE "createdAt" >= ${start} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count FROM "Report" WHERE "createdAt" >= ${start} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`SELECT DATE_TRUNC('day', "viewedAt") AS day, COUNT(*)::int AS count FROM "ProfileView" WHERE "viewedAt" >= ${start} GROUP BY 1 ORDER BY 1`,
  ]);

  const map = (rows: Array<{ day: Date; count: number }>) => rows.map((row) => ({ day: row.day.toISOString(), count: Number(row.count) }));
  await prisma.adminAuditLog.create({
    data: { adminId: access.user.id, action: "VIEW_ANALYTICS", targetType: "ANALYTICS" },
  });

  return NextResponse.json({
    range: { from: start.toISOString(), to: new Date().toISOString() },
    series: { users: map(users), posts: map(posts), messages: map(messages), reports: map(reports), profileViews: map(profileViews) },
  });
}
