import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import * as z from "zod";

const blockInput = z.object({ userId: z.string().min(1).max(100) });

async function getSession() { return auth.api.getSession({ headers: await headers() }); }

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const blocks = await prisma.block.findMany({
    where: { blockerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true, isActive: true } } },
  });
  return NextResponse.json({ blockedUsers: blocks.map((row) => ({ ...row.blocked, blockedAt: row.createdAt })) });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limit = await consumeRateLimit(rateLimitKey("blocks", request, session.user.id), 30, 3600);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const parsed = blockInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid user ID is required." }, { status: 400 });
  const result = await prisma.block.deleteMany({ where: { blockerId: session.user.id, blockedId: parsed.data.userId } });
  if (!result.count) return NextResponse.json({ error: "That user is not blocked." }, { status: 404 });
  return NextResponse.json({ blocked: false });
}