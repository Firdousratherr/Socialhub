import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushDeviceInputSchema } from "@/lib/validation";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const devices = await prisma.pushDevice.findMany({
    where: { userId: session.user.id },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      platform: true,
      provider: true,
      appVersion: true,
      deviceName: true,
      enabled: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ devices });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rl = await consumeRateLimit(rateLimitKey("push-register", request, session.user.id), 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const parsed = pushDeviceInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid push device." }, { status: 400 });
  }

  const existing = await prisma.pushDevice.findUnique({
    where: { token: parsed.data.token },
    select: { id: true, userId: true },
  });

  if (existing && existing.userId !== session.user.id) {
    await prisma.pushDevice.delete({ where: { id: existing.id } });
  }

  const device = await prisma.pushDevice.upsert({
    where: { token: parsed.data.token },
    create: {
      userId: session.user.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      provider: parsed.data.provider,
      appVersion: parsed.data.appVersion ?? null,
      deviceName: parsed.data.deviceName ?? null,
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      userId: session.user.id,
      platform: parsed.data.platform,
      provider: parsed.data.provider,
      appVersion: parsed.data.appVersion ?? null,
      deviceName: parsed.data.deviceName ?? null,
      enabled: true,
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      platform: true,
      provider: true,
      appVersion: true,
      deviceName: true,
      enabled: true,
      lastSeenAt: true,
    },
  });

  return NextResponse.json({ device }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : null;
  if (!token && !deviceId) return NextResponse.json({ error: "Provide a token or device id." }, { status: 400 });

  await prisma.pushDevice.deleteMany({
    where: {
      userId: session.user.id,
      ...(deviceId ? { id: deviceId } : { token: token! }),
    },
  });

  return NextResponse.json({ removed: true });
}
