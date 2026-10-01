import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIds } from "@/lib/social-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 20), 1), 50);
  const session = await auth.api.getSession({ headers: await headers() });
  const blockedIds = session?.user ? await getBlockedUserIds(session.user.id) : [];

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(session?.user ? { id: { notIn: [session.user.id, ...blockedIds] } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      isPrivate: true,
      _count: {
        select: { followers: true, following: true },
      },
    },
  });

  return NextResponse.json({ users });
}
