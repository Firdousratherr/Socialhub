import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

const commandSchema = z.object({
  deviceId: z.string().trim().min(1),
  action: z.enum([
    "SYNC_INVENTORY",
    "APPLY_POLICY",
    "LOCK_DEVICE",
    "REQUEST_UPDATE",
    "OPEN_DEVICE_SETTINGS",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
  expiresAt: z.coerce.date().optional(),
});

export async function POST(request: Request) {
  const access = await requireAdminPermission("DEVICE_MANAGEMENT");
  if (access.response) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid device command." }, { status: 400 });

  const device = await prisma.managedDevice.findUnique({
    where: { id: parsed.data.deviceId },
    select: { id: true, status: true, userId: true },
  });
  if (!device) return NextResponse.json({ error: "Managed device not found." }, { status: 404 });
  if (device.status === "REVOKED") return NextResponse.json({ error: "Device management has been revoked." }, { status: 409 });

  const command = await prisma.deviceCommand.create({
    data: {
      deviceId: device.id,
      requestedById: access.user.id,
      action: parsed.data.action,
      payload: parsed.data.payload ? JSON.stringify(parsed.data.payload) : null,
      expiresAt: parsed.data.expiresAt,
    },
  });

  await prisma.deviceManagementAudit.create({
    data: {
      deviceId: device.id,
      actorId: access.user.id,
      action: "CREATE_DEVICE_COMMAND",
      resource: "DEVICE_COMMAND",
      resourceId: command.id,
      details: JSON.stringify({ command: parsed.data.action }),
    },
  });

  await recordAdminEvent({
    access,
    request,
    action: "CREATE_DEVICE_COMMAND",
    resource: "DEVICE_COMMAND",
    resourceId: command.id,
    reason: "Explicit device-management command queued.",
    after: { deviceId: device.id, action: parsed.data.action },
  });

  return NextResponse.json({ command }, { status: 201 });
}
