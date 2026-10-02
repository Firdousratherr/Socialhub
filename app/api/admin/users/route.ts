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
  let cursor: { createdAt: Date; id: string } | null = null;
  if (before) {
    try {
      const decoded = JSON.parse(Buffer.from(before, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
      if (!decoded.createdAt || !decoded.id) throw new Error("invalid");
      const createdAt = new Date(decoded.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
      cursor = { createdAt, id: decoded.id };
    } catch {
      return NextResponse.json({ error: "Invalid user cursor." }, { status: 400 });
    }
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
        ...(q ? [{
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { username: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }] : []),
      ],
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
      isPrivate: true,
      emailVerified: true,
      isVerified: true,
      isOwner: true,
      verifiedAt: true,
      createdAt: true,
      _count: { select: { posts: true, followers: true, following: true } },
    },
  });

  const last = users.at(-1);
  const nextBefore = users.length === take && last
    ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }), "utf8").toString("base64url")
    : null;
  return NextResponse.json({ users, nextBefore });
}
