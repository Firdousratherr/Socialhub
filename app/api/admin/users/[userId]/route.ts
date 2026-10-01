import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
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

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true, role: true, isActive: true, isPrivate: true, emailVerified: true },
  });
  if (!before) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const patch = parsed.data;

  if (patch.role && patch.role !== before.role && access.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can change user roles." }, { status: 403 });
  }

  if (
    access.user.id === userId &&
    ((patch.role && patch.role !== "ADMIN") || patch.isActive === false)
  ) {
    return NextResponse.json({ error: "You cannot disable or demote your own administrator account." }, { status: 400 });
  }

  if (
    access.user.role !== "ADMIN" &&
    (before.role === "ADMIN" || (patch.role && patch.role === "ADMIN"))
  ) {
    return NextResponse.json({ error: "Moderators cannot modify administrator accounts." }, { status: 403 });
  }

  if (patch.role === "ADMIN" && before.role !== "ADMIN") {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN", id: { not: userId } },
      select: { id: true },
    });
    if (!existingAdmin && before.role !== "ADMIN") {
      // Normal role promotion remains available after bootstrap; this branch just makes the policy explicit.
    }
  }

  const user = await prisma.user.update({ where: { id: userId }, data: patch });

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.session!.user.id,
      action: "UPDATE_USER",
      targetType: "USER",
      targetId: userId,
      details: JSON.stringify({ before, after: patch }),
    },
  });

  return NextResponse.json({ user });
}
