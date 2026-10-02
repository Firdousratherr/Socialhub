import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { safeDeleteBlob } from "@/lib/blob-cleanup";

export async function GET(request: Request) {
  const access = await requireAdminPermission("CONTENT_MODERATE");
  if (access.response) return access.response;
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const stories = await prisma.story.findMany({
    where: q ? { OR: [{ caption: { contains: q, mode: "insensitive" } }, { author: { name: { contains: q, mode: "insensitive" } } }, { author: { username: { contains: q, mode: "insensitive" } } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, mediaUrl: true, caption: true, audience: true, expiresAt: true, createdAt: true, author: { select: { id: true, name: true, username: true } }, _count: { select: { views: true, replies: true, reactions: true } } },
  });
  await prisma.adminAuditLog.create({ data: { adminId: access.user.id, action: "VIEW_ADMIN_STORIES", targetType: "STORY", details: JSON.stringify({ q }) } });
  return NextResponse.json({ stories });
}

export async function DELETE(request: Request) {
  const access = await requireAdminPermission("CONTENT_MODERATE");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const storyId = typeof body?.storyId === "string" ? body.storyId : "";
  const replyId = typeof body?.replyId === "string" ? body.replyId : "";
  if (replyId) {
    const reply = await prisma.storyReply.findUnique({ where: { id: replyId }, select: { id: true, content: true } });
    if (!reply) return NextResponse.json({ error: "Story reply not found." }, { status: 404 });
    await prisma.storyReply.delete({ where: { id: replyId } });
    await prisma.adminAuditLog.create({ data: { adminId: access.user.id, action: "DELETE_STORY_REPLY", targetType: "STORY_REPLY", targetId: replyId } });
    return NextResponse.json({ ok: true });
  }
  if (!storyId) return NextResponse.json({ error: "Story id is required." }, { status: 400 });
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, mediaUrl: true } });
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
  await prisma.story.delete({ where: { id: storyId } });
  await safeDeleteBlob(story.mediaUrl);
  await prisma.adminAuditLog.create({ data: { adminId: access.user.id, action: "DELETE_STORY", targetType: "STORY", targetId: storyId } });
  return NextResponse.json({ ok: true });
}
