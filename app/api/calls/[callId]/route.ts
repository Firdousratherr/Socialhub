import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Props = { params: Promise<{ callId: string }> };

const schema = z.object({
  status: z.enum(["RINGING", "ACTIVE", "ENDED", "DECLINED"]),
});

export async function PATCH(request: Request, { params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { callId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid call status." }, { status: 400 });

  const call = await prisma.callSession.findUnique({ where: { id: callId } });
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const member = await prisma.conversationMember.findFirst({
    where: { conversationId: call.conversationId, userId: session.user.id },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const now = new Date();
  const updated = await prisma.callSession.update({
    where: { id: call.id },
    data: {
      status: parsed.data.status,
      startedAt: parsed.data.status === "ACTIVE" && !call.startedAt ? now : call.startedAt,
      endedAt: ["ENDED", "DECLINED"].includes(parsed.data.status) ? now : null,
    },
  });

  return NextResponse.json({ call: updated });
}
