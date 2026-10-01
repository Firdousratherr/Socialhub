import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as z from "zod";
import { requireAdmin } from "@/app/api/admin/_auth";

const metricSchema = z.object({
  followers: z.number().int().min(0).max(100000000).nullable().optional(),
  following: z.number().int().min(0).max(100000000).nullable().optional(),
  posts: z.number().int().min(0).max(100000000).nullable().optional(),
  likesReceived: z.number().int().min(0).max(1000000000).nullable().optional(),
  commentsReceived: z.number().int().min(0).max(1000000000).nullable().optional(),
  shares: z.number().int().min(0).max(1000000000).nullable().optional(),
  profileViews: z.number().int().min(0).max(1000000000).nullable().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdmin();
  if (access.response) return access.response;
  const { userId } = await params;

  const [user, override] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, username: true, image: true,
        _count: { select: { posts: true, followers: true, following: true, likes: true, comments: true } },
        posts: { select: { id: true, shareCount: true, _count: { select: { likes: true, comments: true } } } },
      },
    }),
    prisma.adminMetricOverride.findUnique({ where: { userId } }),
  ]);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const actual = {
    followers: user._count.followers,
    following: user._count.following,
    posts: user._count.posts,
    likesReceived: user.posts.reduce((sum, post) => sum + post._count.likes, 0),
    commentsReceived: user.posts.reduce((sum, post) => sum + post._count.comments, 0),
    shares: user.posts.reduce((sum, post) => sum + post.shareCount, 0),
    profileViews: 0,
  };
  const visible = Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, (override?.[key as keyof typeof actual] as number | null | undefined) ?? value]));
  return NextResponse.json({ actual, override, visible });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdmin();
  if (access.response) return access.response;
  const { userId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = metricSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid metric values." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, username: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const existing = await prisma.adminMetricOverride.findUnique({ where: { userId } });
  const override = await prisma.adminMetricOverride.upsert({
    where: { userId },
    update: parsed.data,
    create: { userId, ...parsed.data },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.session!.user.id,
      action: "UPDATE_ENGAGEMENT",
      targetType: "USER",
      targetId: userId,
      details: JSON.stringify({ before: existing, after: parsed.data }),
    },
  });

  return NextResponse.json({ override });
}
