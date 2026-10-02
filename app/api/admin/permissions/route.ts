import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission, ADMIN_PERMISSIONS } from "@/lib/admin-permissions";

const schema = z.object({
  adminId: z.string().min(1),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length),
});

export async function GET() {
  const access = await requireAdminPermission("ADMIN_MANAGE");
  if (access.response) return access.response;

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MODERATOR"] }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, username: true, email: true, role: true, isOwner: true,
      adminPermissions: { select: { permission: true } },
    },
  });

  return NextResponse.json({
    admins: admins.map((admin) => ({
      ...admin,
      permissions: admin.adminPermissions.map((item) => item.permission),
      allPermissions: admin.role === "ADMIN" ? [...ADMIN_PERMISSIONS] : [],
    })),
    permissions: ADMIN_PERMISSIONS,
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdminPermission("ADMIN_MANAGE");
  if (access.response) return access.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid admin permissions." }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.adminId },
    select: { id: true, role: true, isOwner: true },
  });
  if (!target || !["ADMIN", "MODERATOR"].includes(target.role)) {
    return NextResponse.json({ error: "Administrator or moderator not found." }, { status: 404 });
  }
  if (target.isOwner && target.id !== access.user.id) {
    return NextResponse.json({ error: "The owner administrator's permissions cannot be changed by another administrator." }, { status: 403 });
  }

  await prisma.adminPermission.deleteMany({ where: { adminId: target.id } });
  if (target.role === "MODERATOR" && parsed.data.permissions.length) {
    await prisma.adminPermission.createMany({
      data: parsed.data.permissions.map((permission) => ({ adminId: target.id, permission })),
      skipDuplicates: true,
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.user.id,
      action: "UPDATE_ADMIN_PERMISSIONS",
      targetType: "ADMIN",
      targetId: target.id,
      details: JSON.stringify({ permissions: parsed.data.permissions }),
    },
  });

  return NextResponse.json({ ok: true });
}
