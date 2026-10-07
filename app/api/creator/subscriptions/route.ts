import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformEnabled } from "@/lib/platform-controls";

async function getSession() { return auth.api.getSession({ headers: await headers() }); }

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const [owned, joined] = await Promise.all([
    prisma.creatorSubscription.findMany({ where: { creatorId: session.user.id }, orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, name: true, username: true, image: true } } } }),
    prisma.creatorSubscription.findMany({ where: { memberId: session.user.id }, orderBy: { createdAt: "desc" }, include: { creator: { select: { id: true, name: true, username: true, image: true } } } }),
  ]);
  return NextResponse.json({ owned, joined });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const enabled = await platformEnabled("creatorFeatures", false);
  if (!enabled) return NextResponse.json({ error: "Creator features are currently disabled." }, { status: 503 });

  const body = await request.json().catch(() => null) as { creatorId?: string } | null;
  const creatorId = typeof body?.creatorId === "string" ? body.creatorId : "";
  if (!creatorId || creatorId === session.user.id) return NextResponse.json({ error: "Invalid creator." }, { status: 400 });

  const creator = await prisma.creatorProfile.findFirst({
    where: { userId: creatorId, enabled: true },
  });
  if (!creator) return NextResponse.json({ error: "Creator is not accepting memberships." }, { status: 404 });

  const subscription = await prisma.creatorSubscription.upsert({
    where: { creatorId_memberId: { creatorId, memberId: session.user.id } },
    create: {
      creatorId,
      memberId: session.user.id,
      status: "PENDING",
      monthlyPriceCents: creator.monthlyPriceCents,
      currency: creator.currency,
    },
    update: {
      status: "PENDING",
      monthlyPriceCents: creator.monthlyPriceCents,
      currency: creator.currency,
      cancelledAt: null,
    },
  });

  return NextResponse.json({
    subscription,
    paymentRequired: true,
    paymentProvider: null,
    message: "Membership intent recorded. No payment has been collected.",
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { creatorId?: string } | null;
  const creatorId = typeof body?.creatorId === "string" ? body.creatorId : "";
  if (!creatorId) return NextResponse.json({ error: "Invalid creator." }, { status: 400 });

  const existing = await prisma.creatorSubscription.findUnique({
    where: { creatorId_memberId: { creatorId, memberId: session.user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Membership not found." }, { status: 404 });

  const subscription = await prisma.creatorSubscription.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  return NextResponse.json({ subscription });
}
