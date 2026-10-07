import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  conversationId: z.string().trim().min(1),
  kind: z.enum(["AUDIO", "VIDEO"]),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid call request." }, { status: 400 });

  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId: parsed.data.conversationId, userId: session.user.id },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const call = await prisma.callSession.create({
    data: {
      conversationId: parsed.data.conversationId,
      createdById: session.user.id,
      kind: parsed.data.kind,
      provider: process.env.CALL_PROVIDER || "livekit",
      roomName: "socialhub-" + crypto.randomUUID(),
      participants: {
        create: { userId: session.user.id, role: "HOST", joinedAt: new Date() },
      },
    },
    include: { participants: true },
  });

  return NextResponse.json({
    call,
    providerConfigured: Boolean(
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.LIVEKIT_URL
    ),
  }, { status: 201 });
}
