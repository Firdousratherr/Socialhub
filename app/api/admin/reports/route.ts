import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

const statusSchema = z.enum(["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"]);
const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const updateSchema = z.object({
  id: z.string().min(1),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["DELETE_POST", "DELETE_COMMENT", "DISABLE_USER"]),
  note: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = statusParam && statusSchema.safeParse(statusParam).success
    ? statusSchema.parse(statusParam)
    : undefined;
  const before = url.searchParams.get("before");
  let cursor: { createdAt: Date; id: string } | null = null;
  if (before) {
    try {
      const decoded = JSON.parse(Buffer.from(before, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
      if (!decoded.createdAt || !decoded.id) throw new Error("invalid");
      const createdAt = new Date(decoded.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
      cursor = { createdAt, id: decoded.id };
    } catch {
      return NextResponse.json({ error: "Invalid report cursor." }, { status: 400 });
    }
  }

  const reports = await prisma.report.findMany({
    where: {
      AND: [
        ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
        ...(status ? [{ status }] : []),
        ...(q ? [{
          OR: [
            { reason: { contains: q, mode: "insensitive" as const } },
            { reporter: { name: { contains: q, mode: "insensitive" as const } } },
            { reporter: { username: { contains: q, mode: "insensitive" as const } } },
            { reportedUser: { name: { contains: q, mode: "insensitive" as const } } },
            { reportedUser: { username: { contains: q, mode: "insensitive" as const } } },
            { post: { content: { contains: q, mode: "insensitive" as const } } },
            { comment: { content: { contains: q, mode: "insensitive" as const } } },
          ],
        }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 101,
    include: {
      reporter: { select: { id: true, name: true, username: true, image: true } },
      reportedUser: { select: { id: true, name: true, username: true, image: true } },
      assignedTo: { select: { id: true, name: true, username: true } },
      post: { select: { id: true, content: true, mediaUrl: true, authorId: true } },
      comment: { select: { id: true, content: true, authorId: true, postId: true } },
    },
  });

  const hasMore = reports.length > 100;
  const page = reports.slice(0, 100);
  const oldest = page.at(-1);
  const nextBefore = hasMore && oldest ? Buffer.from(JSON.stringify({ createdAt: oldest.createdAt.toISOString(), id: oldest.id }), "utf8").toString("base64url") : null;

  const [pending, reviewed, resolved, dismissed] = await Promise.all([
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "REVIEWED" } }),
    prisma.report.count({ where: { status: "RESOLVED" } }),
    prisma.report.count({ where: { status: "DISMISSED" } }),
  ]);

  return NextResponse.json({ reports: page, nextBefore, counts: { pending, reviewed, resolved, dismissed } });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report update." }, { status: 400 });

  const existing = await prisma.report.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const nextStatus = parsed.data.status ?? existing.status;
  const terminal = nextStatus === "RESOLVED" || nextStatus === "DISMISSED";
  const report = await prisma.report.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.assignedToId !== undefined ? { assignedToId: parsed.data.assignedToId } : {}),
      ...(parsed.data.note !== undefined ? { moderatorNote: parsed.data.note || null } : {}),
      resolvedAt: terminal ? new Date() : nextStatus === "PENDING" || nextStatus === "REVIEWED" ? null : existing.resolvedAt,
      resolvedById: terminal ? access.user.id : nextStatus === "PENDING" || nextStatus === "REVIEWED" ? null : existing.resolvedById,
    },
    include: { assignedTo: { select: { id: true, name: true, username: true } } },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.user.id,
      action: "UPDATE_REPORT",
      targetType: "REPORT",
      targetId: report.id,
      details: JSON.stringify({
        before: { status: existing.status, priority: existing.priority, assignedToId: existing.assignedToId, moderatorNote: existing.moderatorNote },
        after: { status: report.status, priority: report.priority, assignedToId: report.assignedToId, moderatorNote: report.moderatorNote },
        note: parsed.data.note ?? null,
      }),
    },
  });

  return NextResponse.json({ report });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });

  const report = await prisma.report.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, postId: true, commentId: true, reportedUserId: true, status: true },
  });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  if (report.status === "DISMISSED") {
    return NextResponse.json({ error: "Dismissed reports cannot be acted on." }, { status: 409 });
  }

  let targetId = "";
  const actionError = (message: string, status = 409) => NextResponse.json({ error: message }, { status });

  if (parsed.data.action === "DELETE_POST" && !report.postId) return actionError("This report does not target a post.", 400);
  if (parsed.data.action === "DELETE_COMMENT" && !report.commentId) return actionError("This report does not target a comment.", 400);
  if (parsed.data.action === "DISABLE_USER" && !report.reportedUserId) return actionError("This report does not target a user.", 400);

  if (parsed.data.action === "DELETE_POST") {
    const target = await prisma.post.findUnique({ where: { id: report.postId! }, select: { id: true } });
    if (!target) return actionError("Reported post no longer exists.", 404);
  }
  if (parsed.data.action === "DELETE_COMMENT") {
    const target = await prisma.comment.findUnique({ where: { id: report.commentId! }, select: { id: true } });
    if (!target) return actionError("Reported comment no longer exists.", 404);
  }
  if (parsed.data.action === "DISABLE_USER") {
    const target = await prisma.user.findUnique({ where: { id: report.reportedUserId! }, select: { id: true, role: true } });
    if (!target) return actionError("Reported user no longer exists.", 404);
    if (target.role === "ADMIN" && access.user.role !== "ADMIN") return actionError("Moderators cannot disable administrator accounts.", 403);
    if (target.id === access.user.id) return actionError("You cannot disable your own account.", 400);
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.action === "DELETE_POST") {
      if (!report.postId) throw new Error("This report does not target a post.");
      const target = await tx.post.findUnique({ where: { id: report.postId }, select: { id: true, authorId: true } });
      if (!target) throw new Error("Reported post no longer exists.");
      await tx.post.delete({ where: { id: target.id } });
      targetId = target.id;
    }

    if (parsed.data.action === "DELETE_COMMENT") {
      if (!report.commentId) throw new Error("This report does not target a comment.");
      const target = await tx.comment.findUnique({ where: { id: report.commentId }, select: { id: true } });
      if (!target) throw new Error("Reported comment no longer exists.");
      await tx.comment.delete({ where: { id: target.id } });
      targetId = target.id;
    }

    if (parsed.data.action === "DISABLE_USER") {
      if (!report.reportedUserId) throw new Error("This report does not target a user.");
      const target = await tx.user.findUnique({ where: { id: report.reportedUserId }, select: { id: true, role: true } });
      if (!target) throw new Error("Reported user no longer exists.");
      if (target.role === "ADMIN" && access.user.role !== "ADMIN") {
        throw new Error("Moderators cannot disable administrator accounts.");
      }
      if (target.id === access.user.id) {
        throw new Error("You cannot disable your own account.");
      }
      await tx.user.update({ where: { id: target.id }, data: { isActive: false } });
      targetId = target.id;
    }

    await tx.report.update({
      where: { id: report.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: access.user.id },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: access.user.id,
        action: "MODERATION_ACTION",
        targetType: parsed.data.action === "DELETE_POST" ? "POST" : parsed.data.action === "DELETE_COMMENT" ? "COMMENT" : "USER",
        targetId,
        details: JSON.stringify({ reportId: report.id, action: parsed.data.action, note: parsed.data.note ?? null }),
      },
    });
  });

  return NextResponse.json({ success: true, reportId: report.id, action: parsed.data.action, targetId });
}
