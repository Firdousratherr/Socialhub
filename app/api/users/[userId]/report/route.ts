import { NextResponse } from "next/server";
import { consumeMutationRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlocked } from "@/lib/social-access";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("user-reports", request, session.user.id, 10, 3600);

  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const { userId } = await params;
  if (userId === session.user.id || await isBlocked(session.user.id, userId)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  try {
    await prisma.report.create({ data: { reporterId: session.user.id, reportedUserId: userId, reason } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reported this user." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ reported: true }, { status: 201 });
}
