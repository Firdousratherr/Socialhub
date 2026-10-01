import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storyInputSchema } from "@/lib/validation";

export async function GET() {
  const now = new Date();

  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: now },
      audience: "PUBLIC",
      author: { isActive: true },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return NextResponse.json({ stories });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = storyInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid story." },
      { status: 400 },
    );
  }

  if (parsed.data.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Story expiry must be in the future." }, { status: 400 });
  }

  const story = await prisma.story.create({
    data: {
      authorId: session.user.id,
      mediaUrl: parsed.data.mediaUrl,
      caption: parsed.data.caption ?? null,
      audience: parsed.data.audience,
      expiresAt: parsed.data.expiresAt,
    },
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return NextResponse.json({ story }, { status: 201 });
}
