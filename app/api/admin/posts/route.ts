import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import * as z from "zod";

function parseCursor(value: string | null) {
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    if (!payload.createdAt || !payload.id) return null;
    const createdAt = new Date(payload.createdAt);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: payload.id };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

export async function GET(request: Request) {
  const access = await requireAdminPermission("CONTENT_VIEW");
  if (access.response) return access.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const cursor = parseCursor(url.searchParams.get("before"));
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);

  const posts = await prisma.post.findMany({
    where: {
      AND: [
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
        ...(q
          ? [
              {
                OR: [
                  { content: { contains: q, mode: "insensitive" as const } },
                  { author: { name: { contains: q, mode: "insensitive" as const } } },
                  { author: { username: { contains: q, mode: "insensitive" as const } } },
                  { author: { email: { contains: q, mode: "insensitive" as const } } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reports: true } },
      postMetricOverride: true,
    },
  });

  return NextResponse.json({
    posts,
    nextBefore:
      posts.length === take
        ? encodeCursor(posts.at(-1)!.createdAt, posts.at(-1)!.id)
        : null,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const metricSchema = z.object({
    likes: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    comments: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    shares: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  });
  const parsed = z.object({
    id: z.string().min(1),
    visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).optional(),
    metrics: metricSchema.optional(),
  }).safeParse(body);

  if (!parsed.success || (parsed.data.visibility === undefined && parsed.data.metrics === undefined)) {
    return NextResponse.json({ error: "Provide a post visibility or metrics update." }, { status: 400 });
  }
  const access = await requireAdminPermission(parsed.data.metrics !== undefined ? "CONTENT_METRICS" : "CONTENT_MODERATE");
  if (access.response) return access.response;
  if (parsed.data.visibility !== undefined && parsed.data.metrics !== undefined) {
    const moderationAccess = await requireAdminPermission("CONTENT_MODERATE");
    if (moderationAccess.response) return moderationAccess.response;
  }

  const before = await prisma.post.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, visibility: true, authorId: true },
  });
  if (!before) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (parsed.data.metrics !== undefined) {
    const previous = await prisma.adminPostMetricOverride.findUnique({ where: { postId: parsed.data.id } });
    const hasOverride = Object.values(parsed.data.metrics).some((value) => value !== null && value !== undefined);
    const override = hasOverride
      ? await prisma.adminPostMetricOverride.upsert({
          where: { postId: parsed.data.id },
          create: { postId: parsed.data.id, ...parsed.data.metrics },
          update: { ...parsed.data.metrics },
        })
      : (await prisma.adminPostMetricOverride.deleteMany({ where: { postId: parsed.data.id } }), null);
    await prisma.adminAuditLog.create({
      data: {
        adminId: access.user.id,
        action: "UPDATE_POST_METRICS",
        targetType: "POST",
        targetId: parsed.data.id,
        details: JSON.stringify({ before: previous, after: override, reset: !hasOverride }),
      },
    });
  }

  if (parsed.data.visibility === undefined) {
    const override = await prisma.adminPostMetricOverride.findUnique({ where: { postId: parsed.data.id } });
    return NextResponse.json({ post: before, override });
  }

  const post = await prisma.post.update({
    where: { id: parsed.data.id },
    data: { visibility: parsed.data.visibility },
    select: { id: true, visibility: true },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.user.id,
      action: "MODERATE_POST_VISIBILITY",
      targetType: "POST",
      targetId: post.id,
      details: JSON.stringify({ before: before.visibility, after: post.visibility }),
    },
  });

  return NextResponse.json({ post });
}

export async function DELETE(request: Request) {
  const access = await requireAdminPermission("CONTENT_MODERATE");
  if (access.response) return access.response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Post id is required." }, { status: 400 });

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await prisma.post.delete({ where: { id } });

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.user.id,
      action: "DELETE_POST",
      targetType: "POST",
      targetId: id,
      details: JSON.stringify({ authorId: post.authorId }),
    },
  });

  return NextResponse.json({ success: true });
}
