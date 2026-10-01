import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const updateSchema = z.object({
  action: z.enum(["edit", "delete"]),
  content: z.string().trim().min(1).max(5000).optional(),
});

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { messageId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.action !== "edit" || !parsed.data.content) {
    return NextResponse.json({ error: "Provide message content to edit." }, { status: 400 });
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, deletedAt: true },
  });
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (message.senderId !== session.user.id) return NextResponse.json({ error: "You can only edit your own messages." }, { status: 403 });
  if (message.deletedAt) return NextResponse.json({ error: "Deleted messages cannot be edited." }, { status: 409 });

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: parsed.data.content, editedAt: new Date() },
    include: {
      sender: { select: { id: true, name: true, username: true, image: true } },
      attachments: true,
      reactions: { include: { user: { select: { id: true, name: true, image: true } } } },
    },
  });

  return NextResponse.json({ message: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { messageId } = await params;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, deletedAt: true },
  });
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (message.senderId !== session.user.id) return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 });
  if (message.deletedAt) return NextResponse.json({ success: true });

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), content: "" },
    select: { id: true, deletedAt: true, content: true },
  });

  return NextResponse.json({ message: updated });
}
