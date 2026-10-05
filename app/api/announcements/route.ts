import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { isVerified: true, isOwner: true, role: true } })
    : null;
  const audience = new Set<string>(["ALL"]);
  if (user?.isVerified || user?.isOwner) audience.add("VERIFIED");
  if (user?.role === "MODERATOR" || user?.role === "ADMIN") audience.add("MODERATORS");

  const announcements = await prisma.announcement.findMany({
    where: {
      status: "PUBLISHED",
      audience: { in: [...audience] },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, body: true, audience: true, startsAt: true, endsAt: true },
  });

  return NextResponse.json({ announcements });
}