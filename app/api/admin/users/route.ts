import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const before = url.searchParams.get("before");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
  const users = await prisma.user.findMany({
    where: {
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
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

  return NextResponse.json({ users, nextBefore: users.length === take ? users.at(-1)?.createdAt.toISOString() ?? null : null });
}
