import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";
import { Prisma } from "@/app/generated/prisma/client";

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  if (!(await canViewPost(postId, session.user.id))) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  try {
    await prisma.report.create({ data: { reporterId: session.user.id, postId, reason } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reported this post." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ reported: true }, { status: 201 });
}
