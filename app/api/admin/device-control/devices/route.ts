import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

const querySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  status: z.enum(["PENDING", "ACTIVE", "OFFLINE", "NON_COMPLIANT", "REVOKED"]).optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminPermission("DEVICE_MANAGEMENT");
  if (access.response) return access.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get("userId") || undefined,
    status: url.searchParams.get("status") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid device filters." }, { status: 400 });

  const devices = await prisma.managedDevice.findMany({
    where: {
      ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    select: {
      id: true,
      deviceId: true,
      userId: true,
      deviceName: true,
      manufacturer: true,
      model: true,
      androidVersion: true,
      sdkInt: true,
      appVersion: true,
      status: true,
      isDeviceOwner: true,
      isProfileOwner: true,
      lastSeenAt: true,
      enrolledAt: true,
      revokedAt: true,
      owner: { select: { id: true, name: true, username: true, email: true } },
      _count: { select: { applications: true, commands: true } },
    },
  });

  await recordAdminEvent({ access, request, action: "VIEW_MANAGED_DEVICES", resource: "MANAGED_DEVICE" });
  return NextResponse.json({ devices });
}
