import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const existing = await prisma.report.findFirst({
    where: {
      reporterId: session.user.id,
      postId,
      status: { in: ["PENDING", "REVIEWED"] },
    },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "You have already reported this post." }, { status: 409 });

  await prisma.report.create({
    data: { reporterId: session.user.id, postId, reason },
  });

  return NextResponse.json({ reported: true }, { status: 201 });
}
