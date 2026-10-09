import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";

const schema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["ENABLE", "DISABLE", "VERIFY", "UNVERIFY", "REVOKE_SESSIONS"]),
  dryRun: z.boolean().default(false),
});

export async function POST(request: Request) {
  const access = await requireAdminPermission("USERS_BULK");
  if (access.response) return access.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid bulk operation." }, { status: 400 });

  const { userIds, action, dryRun } = parsed.data;
  if (userIds.includes(access.user.id) && ["DISABLE", "REVOKE_SESSIONS"].includes(action)) {
    return NextResponse.json({ error: "You cannot disable your own account or revoke its sessions through bulk actions." }, { status: 400 });
  }
  if (access.user.role !== "ADMIN" && ["VERIFY", "UNVERIFY"].includes(action)) {
    return NextResponse.json({ error: "Only administrators can change verification status through bulk actions." }, { status: 403 });
  }

  const selectedUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, isOwner: true },
  });
  const foundIds = new Set(selectedUsers.map((user) => user.id));
  const missingCount = userIds.filter((id) => !foundIds.has(id)).length;
  const skippedOwnerIds =
    action === "VERIFY" ? [] : selectedUsers.filter((user) => user.isOwner).map((user) => user.id);
  const skippedPrivilegedIds =
    access.user.role === "ADMIN"
      ? []
      : selectedUsers.filter((user) => user.role !== "USER").map((user) => user.id);
  const eligibleUsers = selectedUsers.filter((user) => {
    if (action !== "VERIFY" && user.isOwner) return false;
    if (access.user.role !== "ADMIN" && user.role !== "USER") return false;
    return true;
  });
  const eligibleIds = eligibleUsers.map((user) => user.id);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      action,
      requestedCount: userIds.length,
      count: eligibleIds.length,
      skippedOwnerCount: skippedOwnerIds.length,
      skippedPrivilegedCount: skippedPrivilegedIds.length,
      missingCount,
      skippedOwnerIds,
      skippedPrivilegedIds,
    });
  }

  if (action === "REVOKE_SESSIONS") {
    if (eligibleIds.length) await prisma.session.deleteMany({ where: { userId: { in: eligibleIds } } });
  } else if (eligibleIds.length) {
    const data =
      action === "ENABLE"
        ? { isActive: true }
        : action === "DISABLE"
          ? { isActive: false }
          : action === "VERIFY"
            ? { isVerified: true, verifiedAt: new Date() }
            : { isVerified: false, verifiedAt: null };

    await prisma.user.updateMany({ where: { id: { in: eligibleIds } }, data });
  }

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.user.id,
      action: "BULK_USER_" + action,
      targetType: "USER_BATCH",
      details: JSON.stringify({ userIds, count: eligibleIds.length, skippedOwnerIds, skippedPrivilegedIds, missingCount }),
    },
  });

  return NextResponse.json({
    ok: true,
    count: eligibleIds.length,
    skippedOwnerCount: skippedOwnerIds.length,
    skippedPrivilegedCount: skippedPrivilegedIds.length,
    missingCount,
  });
}
