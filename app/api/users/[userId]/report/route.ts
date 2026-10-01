import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { userId } = await params;
  if (userId === session.user.id) return NextResponse.json({ error: "You cannot report yourself." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!target?.isActive) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const existing = await prisma.report.findFirst({
    where: {
      reporterId: session.user.id,
      reportedUserId: userId,
      status: { in: ["PENDING", "REVIEWED"] },
    },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "You have already reported this user." }, { status: 409 });

  await prisma.report.create({ data: { reporterId: session.user.id, reportedUserId: userId, reason } });
  return NextResponse.json({ reported: true }, { status: 201 });
}
