import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET() {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { id: true, name: true, username: true, image: true } },
      reportedUser: { select: { id: true, name: true, username: true, image: true } },
      post: { select: { id: true, content: true, mediaUrl: true } },
      comment: { select: { id: true, content: true } },
    },
  });

  const [pending, reviewed, resolved, dismissed] = await Promise.all([
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "REVIEWED" } }),
    prisma.report.count({ where: { status: "RESOLVED" } }),
    prisma.report.count({ where: { status: "DISMISSED" } }),
  ]);

  return NextResponse.json({
    reports,
    counts: { pending, reviewed, resolved, dismissed },
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status;
  if (!id || !["REVIEWED", "RESOLVED", "DISMISSED", "PENDING"].includes(status)) {
    return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
  }

  const report = await prisma.report.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null,
      resolvedById: status === "RESOLVED" || status === "DISMISSED" ? access.session?.user.id : null,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.session?.user.id ?? "unknown",
      action: "UPDATE_REPORT",
      targetType: "REPORT",
      targetId: report.id,
      details: JSON.stringify({ status }),
    },
  });

  return NextResponse.json({ report });
}
