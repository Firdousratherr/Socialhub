import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";
import * as z from "zod";

const reactionSchema = z.object({
  emoji: z.enum(["❤️","😂","😮","😢","🔥","👍"]),
});

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });
  const parsed = reactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unsupported reaction." }, { status: 400 });

  const reaction = await prisma.postReaction.upsert({
    where: { postId_userId: { postId, userId: session.user.id } },
    create: { postId, userId: session.user.id, emoji: parsed.data.emoji },
    update: { emoji: parsed.data.emoji },
  });
  return NextResponse.json({ reaction });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  await prisma.postReaction.deleteMany({ where: { postId, userId: session.user.id } });
  return NextResponse.json({ reaction: null });
}
