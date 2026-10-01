import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await prisma.savedPost.upsert({
    where: { userId_postId: { userId: session.user.id, postId } },
    update: {},
    create: { userId: session.user.id, postId },
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  await prisma.savedPost.deleteMany({ where: { userId: session.user.id, postId } });
  return NextResponse.json({ saved: false });
}
