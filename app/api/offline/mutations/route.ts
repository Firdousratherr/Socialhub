import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  clientId: z.string().trim().min(1).max(100),
  operation: z.string().trim().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid offline mutation." }, { status: 400 });

  const mutation = await prisma.offlineMutation.upsert({
    where: { userId_clientId: { userId: session.user.id, clientId: parsed.data.clientId } },
    create: {
      userId: session.user.id,
      clientId: parsed.data.clientId,
      operation: parsed.data.operation,
      payload: JSON.stringify(parsed.data.payload),
    },
    update: {},
  });

  return NextResponse.json({ mutation });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const mutations = await prisma.offlineMutation.findMany({
    where: { userId: session.user.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ mutations });
}
