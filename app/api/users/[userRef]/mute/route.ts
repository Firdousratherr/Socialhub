import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeMutationRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const paramsSchema = z.object({ userId: z.string().min(1).max(100) });

async function parseUserId(params: Promise<{ userRef: string }>) {
  const parsed = paramsSchema.safeParse({ userId: (await params).userRef });
  return parsed.success ? parsed.data.userId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ userRef: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("user-mutes", request, session.user.id, 30, 3600);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const userId = await parseUserId(params);
  if (!userId || userId === session.user.id) {
    return NextResponse.json({ error: "You cannot mute this account." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, deletedAt: true },
  });
  if (!target?.isActive || target.deletedAt) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.mute.upsert({
    where: { muterId_mutedId: { muterId: session.user.id, mutedId: userId } },
    create: { muterId: session.user.id, mutedId: userId },
    update: {},
  });

  return NextResponse.json({ muted: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userRef: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("user-mutes", request, session.user.id, 30, 3600);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const userId = await parseUserId(params);
  if (!userId) return NextResponse.json({ error: "A valid user ID is required." }, { status: 400 });

  const result = await prisma.mute.deleteMany({
    where: { muterId: session.user.id, mutedId: userId },
  });
  if (!result.count) return NextResponse.json({ error: "That user is not muted." }, { status: 404 });

  return NextResponse.json({ muted: false });
}
