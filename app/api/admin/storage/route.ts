import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { safeDeleteBlob } from "@/lib/blob-cleanup";

export async function GET() {
  const access = await requireAdminPermission("STORAGE_VIEW");
  if (access.response) return access.response;

  const [usage, byUser, profiles, posts, stories, attachments, mediaAssets] = await Promise.all([
    prisma.uploadUsage.aggregate({ _sum: { bytes: true }, _count: { _all: true } }),
    prisma.uploadUsage.groupBy({ by: ["userId"], _sum: { bytes: true }, _count: { _all: true }, orderBy: { _sum: { bytes: "desc" } }, take: 20 }),
    prisma.user.findMany({ where: { image: { not: null } }, select: { image: true } }),
    prisma.post.findMany({ where: { mediaUrl: { not: null } }, select: { mediaUrl: true } }),
    prisma.story.findMany({ select: { mediaUrl: true } }),
    prisma.messageAttachment.findMany({ select: { url: true } }),
    prisma.mediaAsset.findMany({ select: { url: true } }),
  ]);

  const referenced = new Set<string>();
  for (const row of profiles) if (row.image) referenced.add(row.image);
  for (const row of posts) if (row.mediaUrl) referenced.add(row.mediaUrl);
  for (const row of stories) referenced.add(row.mediaUrl);
  for (const row of attachments) referenced.add(row.url);
  for (const row of mediaAssets) referenced.add(row.url);
  for (const row of mediaAssets) referenced.add(row.url);

  const recentUploads = await prisma.uploadUsage.findMany({
    orderBy: { bytes: "desc" },
    take: 200,
    select: { id: true, userId: true, bytes: true, url: true, pathname: true, mimeType: true, createdAt: true },
  });

  const orphaned = recentUploads.filter((row) => Boolean(row.url) && !referenced.has(row.url as string)).slice(0, 50);
  await prisma.adminAuditLog.create({
    data: { adminId: access.user.id, action: "VIEW_STORAGE", targetType: "STORAGE", details: JSON.stringify({ referencedCount: referenced.size, orphanCandidates: orphaned.length }) },
  });

  return NextResponse.json({
    totals: { bytes: usage._sum.bytes ?? 0, files: usage._count._all },
    byUser: byUser.map((row) => ({ userId: row.userId, bytes: row._sum.bytes ?? 0, files: row._count._all })),
    largest: recentUploads.slice(0, 20),
    orphaned,
  });
}

export async function DELETE(request: Request) {
  const access = await requireAdminPermission("STORAGE_MANAGE");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value: unknown): value is string => typeof value === "string").slice(0, 50) : [];
  if (!ids.length) return NextResponse.json({ error: "Provide upload ids." }, { status: 400 });

  const rows = await prisma.uploadUsage.findMany({ where: { id: { in: ids } }, select: { id: true, url: true } });
  const referenced = new Set<string>();
  const [profiles, posts, stories, attachments, mediaAssets] = await Promise.all([
    prisma.user.findMany({ where: { image: { not: null } }, select: { image: true } }),
    prisma.post.findMany({ where: { mediaUrl: { not: null } }, select: { mediaUrl: true } }),
    prisma.story.findMany({ select: { mediaUrl: true } }),
    prisma.messageAttachment.findMany({ select: { url: true } }),
    prisma.mediaAsset.findMany({ select: { url: true } }),
  ]);
  for (const row of profiles) if (row.image) referenced.add(row.image);
  for (const row of posts) if (row.mediaUrl) referenced.add(row.mediaUrl);
  for (const row of stories) referenced.add(row.mediaUrl);
  for (const row of attachments) referenced.add(row.url);

  const deletable = rows.filter((row) => row.url && !referenced.has(row.url));
  await Promise.all(deletable.map((row) => safeDeleteBlob(row.url)));
  await prisma.uploadUsage.deleteMany({ where: { id: { in: deletable.map((row) => row.id) } } });
  await prisma.adminAuditLog.create({
    data: { adminId: access.user.id, action: "DELETE_ORPHANED_UPLOADS", targetType: "STORAGE", details: JSON.stringify({ requested: ids.length, deleted: deletable.length }) },
  });
  return NextResponse.json({ deleted: deletable.length });
}
