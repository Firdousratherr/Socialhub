import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

const appSchema = z.object({
  packageName: z.string().trim().min(1).max(255),
  appName: z.string().trim().min(1).max(255),
  versionName: z.string().trim().max(100).optional(),
  versionCode: z.string().trim().max(100).optional(),
  isSystemApp: z.boolean().optional(),
});

const inventorySchema = z.object({
  deviceId: z.string().trim().min(1).max(255),
  deviceName: z.string().trim().max(255).optional(),
  manufacturer: z.string().trim().max(255).optional(),
  model: z.string().trim().max(255).optional(),
  androidVersion: z.string().trim().max(100).optional(),
  sdkInt: z.number().int().min(21).max(100).optional(),
  appVersion: z.string().trim().max(100).optional(),
  apps: z.array(appSchema).max(500).default([]),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = inventorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid device inventory." }, { status: 400 });

  const now = new Date();
  const device = await prisma.managedDevice.upsert({
    where: { deviceId: parsed.data.deviceId },
    create: {
      deviceId: parsed.data.deviceId,
      userId: session.user.id,
      deviceName: parsed.data.deviceName,
      manufacturer: parsed.data.manufacturer,
      model: parsed.data.model,
      androidVersion: parsed.data.androidVersion,
      sdkInt: parsed.data.sdkInt,
      appVersion: parsed.data.appVersion,
      status: "ACTIVE",
      lastSeenAt: now,
    },
    update: {
      deviceName: parsed.data.deviceName,
      manufacturer: parsed.data.manufacturer,
      model: parsed.data.model,
      androidVersion: parsed.data.androidVersion,
      sdkInt: parsed.data.sdkInt,
      appVersion: parsed.data.appVersion,
      status: "ACTIVE",
      lastSeenAt: now,
    },
    select: { id: true, userId: true },
  });

  if (device.userId !== session.user.id) {
    return NextResponse.json({ error: "This device is enrolled to another account." }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.installedApplication.deleteMany({ where: { deviceId: device.id } }),
    prisma.installedApplication.createMany({
      data: parsed.data.apps.map((app) => ({
        deviceId: device.id,
        packageName: app.packageName,
        appName: app.appName,
        versionName: app.versionName,
        versionCode: app.versionCode,
        isSystemApp: app.isSystemApp ?? false,
        lastSeenAt: now,
      })),
    }),
    prisma.deviceInventorySnapshot.create({
      data: {
        deviceId: device.id,
        appCount: parsed.data.apps.length,
        payload: JSON.stringify({ source: "user-enrolled-device" }),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, deviceId: device.id, appCount: parsed.data.apps.length });
}
