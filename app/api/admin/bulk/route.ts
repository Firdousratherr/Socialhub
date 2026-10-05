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
  if (userIds.includes(access.user.id) && action === "DISABLE") {
    return NextResponse.json({ error: "You cannot disable your own administrator account." }, { status: 400 });
  }

  const selectedUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, isOwner: true },
  });
  const foundIds = new Set(selectedUsers.map((user) => user.id));
  const missingCount = userIds.filter((id) => !foundIds.has(id)).length;
  const skippedOwnerIds =
    action === "VERIFY" ? [] : selectedUsers.filter((user) => user.isOwner).map((user) => user.id);
  const eligibleIds =
    action === "VERIFY"
      ? selectedUsers.map((user) => user.id)
      : selectedUsers.filter((user) => !user.isOwner).map((user) => user.id);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      action,
      requestedCount: userIds.length,
      count: eligibleIds.length,
      skippedOwnerCount: skippedOwnerIds.length,
      missingCount,
      skippedOwnerIds,
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
      details: JSON.stringify({ userIds, count: eligibleIds.length, skippedOwnerIds, missingCount }),
    },
  });

  return NextResponse.json({
    ok: true,
    count: eligibleIds.length,
    skippedOwnerCount: skippedOwnerIds.length,
    missingCount,
  });
}
