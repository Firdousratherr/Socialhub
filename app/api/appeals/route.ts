import { NextResponse } from "next/server";
import * as z from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const submitSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
  evidence: z.string().trim().max(5000).nullable().optional(),
  caseId: z.string().min(1).nullable().optional(),
});

async function sessionUser() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await sessionUser();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const appeals = await prisma.adminAppeal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ appeals });
}

export async function POST(request: Request) {
  const session = await sessionUser();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid appeal." }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, suspendedUntil: true, suspensionReason: true, postingRestrictedUntil: true, commentingRestrictedUntil: true, messagingRestrictedUntil: true, socialRestrictedUntil: true },
  });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const hasEnforcement = Boolean(
    target.suspensionReason ||
    target.suspendedUntil ||
    target.postingRestrictedUntil ||
    target.commentingRestrictedUntil ||
    target.messagingRestrictedUntil ||
    target.socialRestrictedUntil,
  );
  if (!hasEnforcement) return NextResponse.json({ error: "There is no active enforcement action to appeal." }, { status: 409 });

  const openAppeal = await prisma.adminAppeal.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    select: { id: true },
  });
  if (openAppeal) return NextResponse.json({ error: "You already have a pending appeal." }, { status: 409 });

  const appeal = await prisma.adminAppeal.create({
    data: {
      userId: session.user.id,
      caseId: parsed.data.caseId ?? null,
      reason: parsed.data.reason,
      evidence: parsed.data.evidence ?? null,
    },
  });

  await prisma.adminAuditEvent.create({
    data: {
      actorId: session.user.id,
      actorRole: "USER",
      action: "SUBMIT_APPEAL",
      resource: "APPEAL",
      resourceId: appeal.id,
      caseId: appeal.caseId,
      reason: appeal.reason,
      outcome: "SUCCESS",
      riskLevel: "LOW",
    },
  });

  return NextResponse.json({ appeal }, { status: 201 });
}
