import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postVisibilityEnum } from "@/lib/validation";

async function session() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const s = await session();
  if (!s?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const draft = await prisma.postDraft.findUnique({ where: { userId: s.user.id } });
  return NextResponse.json({ draft });
}

export async function PUT(request: Request) {
  const s = await session();
  if (!s?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    content?: unknown;
    mediaUrl?: unknown;
    visibility?: unknown;
  } | null;

  const content = typeof body?.content === "string" ? body.content.slice(0, 5000) : null;
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.slice(0, 2000) : null;
  const visibility = postVisibilityEnum.safeParse(body?.visibility ?? "PUBLIC");
  if (!visibility.success) return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });

  const draft = await prisma.postDraft.upsert({
    where: { userId: s.user.id },
    create: { userId: s.user.id, content, mediaUrl, visibility: visibility.data },
    update: { content, mediaUrl, visibility: visibility.data },
  });
  return NextResponse.json({ draft });
}

export async function DELETE() {
  const s = await session();
  if (!s?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  await prisma.postDraft.deleteMany({ where: { userId: s.user.id } });
  return NextResponse.json({ deleted: true });
}
