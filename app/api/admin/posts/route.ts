import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";
import * as z from "zod";

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const before = url.searchParams.get("before");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);

  const posts = await prisma.post.findMany({
    where: {
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      ...(q ? {
        OR: [
          { content: { contains: q, mode: "insensitive" } },
          { author: { name: { contains: q, mode: "insensitive" } } },
          { author: { username: { contains: q, mode: "insensitive" } } },
          { author: { email: { contains: q, mode: "insensitive" } } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reports: true } },
    },
  });

  return NextResponse.json({ posts, nextBefore: posts.length === take ? posts.at(-1)?.createdAt.toISOString() ?? null : null });
}


export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = z.object({
    id: z.string().min(1),
    visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).optional(),
  }).safeParse(body);

  if (!parsed.success || !parsed.data.visibility) {
    return NextResponse.json({ error: "Provide a post id and visibility." }, { status: 400 });
  }

  const before = await prisma.post.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, visibility: true, authorId: true },
  });
  if (!before) return NextResponse.json({ error: "Post not found." }, { status: 404 });

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
  const access = await requireAdmin();
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
