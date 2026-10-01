import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const access = await canViewPost(postId, session.user.id);
  if (!access.allowed || !access.post) return NextResponse.json({ error: "Post unavailable." }, { status: 404 });

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { shareCount: { increment: 1 } },
    select: { shareCount: true },
  });

  if (access.post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: access.post.authorId,
        actorId: session.user.id,
        type: "SHARE",
        postId,
      },
    });
  }

  return NextResponse.json({ shareCount: updated.shareCount });
}
