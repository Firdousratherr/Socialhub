import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";
import { requireAdmin } from "@/app/api/admin/_auth";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/).nullable().optional(),
  role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdmin();
  if (access.response) return access.response;
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, username: true, email: true, image: true, bio: true, role: true,
      isActive: true, isPrivate: true, emailVerified: true, createdAt: true,
      _count: { select: { posts: true, likes: true, comments: true, followers: true, following: true, stories: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const override = await prisma.adminMetricOverride.findUnique({ where: { userId } });
  return NextResponse.json({ user, override });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdmin();
  if (access.response) return access.response;
  const { userId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid user update." }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true, role: true, isActive: true, isPrivate: true, emailVerified: true } });
  if (!before) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const user = await prisma.user.update({ where: { id: userId }, data: parsed.data });
  await prisma.adminAuditLog.create({
    data: {
      adminId: access.session!.user.id,
      action: "UPDATE_USER",
      targetType: "USER",
      targetId: userId,
      details: JSON.stringify({ before, after: parsed.data }),
    },
  });

  return NextResponse.json({ user });
}
