import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ pollId: string }> };

export async function POST(request: Request, { params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { pollId } = await params;
  const body = await request.json().catch(() => null);
  const optionId = typeof body?.optionId === "string" ? body.optionId.trim() : "";
  if (!optionId) return NextResponse.json({ error: "Poll option is required." }, { status: 400 });

  const poll = await prisma.poll.findUnique({ where: { id: pollId }, select: { id: true, multiple: true, closesAt: true } });
  if (!poll) return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  if (poll.closesAt && poll.closesAt <= new Date()) return NextResponse.json({ error: "Poll is closed." }, { status: 409 });

  const option = await prisma.pollOption.findFirst({ where: { id: optionId, pollId }, select: { id: true } });
  if (!option) return NextResponse.json({ error: "Invalid poll option." }, { status: 400 });

  if (!poll.multiple) {
    await prisma.pollVote.deleteMany({ where: { pollId, userId: session.user.id } });
  }

  await prisma.pollVote.create({ data: { pollId, optionId, userId: session.user.id } }).catch(async (error) => {
    if (error?.code === "P2002") return;
    throw error;
  });

  const counts = await prisma.pollVote.groupBy({
    by: ["optionId"],
    where: { pollId },
    _count: { _all: true },
  });

  return NextResponse.json({
    votes: counts.map((row) => ({ optionId: row.optionId, count: row._count._all })),
  });
}
