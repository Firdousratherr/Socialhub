import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { safeDeleteBlob } from "@/lib/blob-cleanup";

export async function GET(request: Request) {
  const access = await requireAdminPermission("CONTENT_MODERATE");
  if (access.response) return access.response;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const rows = await prisma.comment.findMany({
    where: q ? { content: { contains: q, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, username: true } }, postId: true, _count: { select: { reports: true, replies: true } } },
  });
  await prisma.adminAuditLog.create({ data: { adminId: access.user.id, action: "VIEW_ADMIN_COMMENTS", targetType: "COMMENT", details: JSON.stringify({ q }) } });
  return NextResponse.json({ comments: rows });
}

export async function DELETE(request: Request) {
  const access = await requireAdminPermission("CONTENT_MODERATE");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Comment id is required." }, { status: 400 });
  const target = await prisma.comment.findUnique({ where: { id }, select: { id: true, content: true } });
  if (!target) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  await prisma.comment.delete({ where: { id } });
  await prisma.adminAuditLog.create({ data: { adminId: access.user.id, action: "DELETE_COMMENT", targetType: "COMMENT", targetId: id, details: JSON.stringify({ content: target.content.slice(0, 200) }) } });
  return NextResponse.json({ ok: true });
}
