import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET() {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
      _count: { select: { likes: true, comments: true, reports: true } },
    },
  });

  return NextResponse.json({ posts });
}
