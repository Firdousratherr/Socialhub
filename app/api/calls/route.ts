import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const takeValue = Number(new URL(request.url).searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeValue) ? Math.min(Math.max(Math.trunc(takeValue), 1), 100) : 50;

  const calls = await prisma.call.findMany({
    where: {
      OR: [{ callerId: session.user.id }, { calleeId: session.user.id }],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      caller: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
      callee: { select: { id: true, name: true, username: true, image: true, isVerified: true, isOwner: true } },
    },
  });

  return NextResponse.json({
    calls: calls.map((call) => ({
      ...call,
      peer: call.callerId === session.user.id ? call.callee : call.caller,
      direction: call.callerId === session.user.id ? "OUTGOING" : "INCOMING",
    })),
  });
}
