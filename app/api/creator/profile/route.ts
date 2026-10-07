import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformEnabled } from "@/lib/platform-controls";

async function getSession() { return auth.api.getSession({ headers: await headers() }); }

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: session.user.id } });
  const [subscribers, posts] = await Promise.all([
    prisma.creatorSubscription.count({ where: { creatorId: session.user.id, status: "ACTIVE" } }),
    prisma.post.count({ where: { authorId: session.user.id } }),
  ]);
  return NextResponse.json({ profile, metrics: { subscribers, posts } });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const enabled = await platformEnabled("creatorFeatures", false);
  if (!enabled) return NextResponse.json({ error: "Creator features are currently disabled." }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    enabled?: unknown; displayName?: unknown; bio?: unknown; monthlyPriceCents?: unknown; currency?: unknown;
  } | null;

  const enabledValue = Boolean(body?.enabled);
  const monthlyPriceCents = Number(body?.monthlyPriceCents ?? 0);
  if (!Number.isInteger(monthlyPriceCents) || monthlyPriceCents < 0 || monthlyPriceCents > 10_000_000) {
    return NextResponse.json({ error: "Invalid creator price." }, { status: 400 });
  }

  const profile = await prisma.creatorProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      enabled: enabledValue,
      displayName: typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 100) : null,
      bio: typeof body?.bio === "string" ? body.bio.trim().slice(0, 1000) : null,
      monthlyPriceCents,
      currency: typeof body?.currency === "string" ? body.currency.toUpperCase().slice(0, 3) : "INR",
    },
    update: {
      enabled: enabledValue,
      displayName: typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 100) : null,
      bio: typeof body?.bio === "string" ? body.bio.trim().slice(0, 1000) : null,
      monthlyPriceCents,
      currency: typeof body?.currency === "string" ? body.currency.toUpperCase().slice(0, 3) : "INR",
    },
  });

  return NextResponse.json({ profile });
}
