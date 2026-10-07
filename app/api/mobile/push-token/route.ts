import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  token: z.string().trim().min(10).max(1000),
  platform: z.enum(["android", "ios", "web"]),
  deviceId: z.string().trim().max(255).optional(),
  appVersion: z.string().trim().max(100).optional(),
  enabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid push registration." }, { status: 400 });

  const subscription = await prisma.pushDeviceToken.upsert({
    where: { token: parsed.data.token },
    create: {
      userId: session.user.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      deviceId: parsed.data.deviceId,
      appVersion: parsed.data.appVersion,
      enabled: parsed.data.enabled ?? true,
    },
    update: {
      userId: session.user.id,
      platform: parsed.data.platform,
      deviceId: parsed.data.deviceId,
      appVersion: parsed.data.appVersion,
      enabled: parsed.data.enabled ?? true,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ registered: true, id: subscription.id });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Token is required." }, { status: 400 });

  const updated = await prisma.pushDeviceToken.updateMany({
    where: { token, userId: session.user.id },
    data: { enabled: false, lastSeenAt: new Date() },
  });

  return NextResponse.json({ disabled: updated.count > 0 });
}
