import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeMutationRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const inputSchema = z.object({ userId: z.string().min(1).max(100) });

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rows = await prisma.mute.findMany({
    where: { muterId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      muted: {
        select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true, isActive: true },
      },
    },
  });

  return NextResponse.json({ mutedUsers: rows.map((row) => ({ ...row.muted, mutedAt: row.createdAt })) });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("mutes", request, session.user.id, 30, 3600);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid user ID is required." }, { status: 400 });

  const result = await prisma.mute.deleteMany({
    where: { muterId: session.user.id, mutedId: parsed.data.userId },
  });

  if (!result.count) return NextResponse.json({ error: "That user is not muted." }, { status: 404 });
  return NextResponse.json({ muted: false });
}
