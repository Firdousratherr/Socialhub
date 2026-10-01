import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";

export async function POST(request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { commentId } = await params;
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, postId: true } });
  if (!comment || !(await canViewPost(comment.postId, session.user.id))) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  try {
    await prisma.report.create({ data: { reporterId: session.user.id, commentId, reason } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reported this comment." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ reported: true }, { status: 201 });
}
