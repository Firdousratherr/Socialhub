import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const users = await prisma.user.findMany({
    where: {
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { posts: true, followers: true, following: true } },
    },
  });

  return NextResponse.json({ users });
}
