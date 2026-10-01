import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 20), 1), 50);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
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
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
    },
  });

  return NextResponse.json({ users });
}
