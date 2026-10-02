import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export const ADMIN_PERMISSIONS = [
  "USERS_VIEW","USERS_EDIT","USERS_SECURITY","USERS_BULK",
  "CONTENT_VIEW","CONTENT_MODERATE","CONTENT_METRICS","MESSAGES_VIEW","REPORTS_MANAGE",
  "VERIFICATION_MANAGE","ANALYTICS_VIEW","AUDIT_VIEW","AUDIT_EXPORT",
  "PLATFORM_SETTINGS","FEATURE_FLAGS","ANNOUNCEMENTS","STORAGE_VIEW",
  "SECURITY_MANAGE","ADMIN_MANAGE","PRIVACY_OPERATIONS",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSIONS)[number];

export async function hasAdminPermission(adminId: string, role: "ADMIN" | "MODERATOR", permission: AdminPermissionKey) {
  if (role === "ADMIN") return true;
  const row = await prisma.adminPermission.findUnique({
    where: { adminId_permission: { adminId, permission } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function requireAdminPermission(permission: AdminPermissionKey) {
  const access = await requireAdmin();
  if (access.response) return access;
  const allowed = await hasAdminPermission(access.user.id, access.user.role, permission);
  if (!allowed) {
    return {
      ...access,
      response: NextResponse.json({ error: `Missing admin permission: ${permission}.` }, { status: 403 }),
    };
  }
  return access;
}
