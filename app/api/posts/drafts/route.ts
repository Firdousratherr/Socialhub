import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const draftSchema = z.object({
  content: z.string().max(10000).nullable().optional(),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).optional(),
  media: z.string().max(50000).nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});

async function sessionUser(request: Request) {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rows = await prisma.postDraft.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ drafts: rows });
}

export async function POST(request: Request) {
  const session = await sessionUser(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid draft." }, { status: 400 });

  const draft = await prisma.postDraft.create({
    data: {
      userId: session.user.id,
      content: parsed.data.content ?? null,
      visibility: parsed.data.visibility ?? "PUBLIC",
      media: parsed.data.media ?? null,
      scheduledAt: parsed.data.scheduledAt ?? null,
    },
  });
  return NextResponse.json({ draft }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await sessionUser(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Draft ID is required." }, { status: 400 });

  const parsed = draftSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft update." }, { status: 400 });

  const existing = await prisma.postDraft.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const draft = await prisma.postDraft.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ draft });
}

export async function DELETE(request: Request) {
  const session = await sessionUser(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Draft ID is required." }, { status: 400 });

  const deleted = await prisma.postDraft.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ deleted: deleted.count > 0 });
}
