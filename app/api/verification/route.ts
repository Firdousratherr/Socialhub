import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const requestSchema = z.object({
  reason: z.string().trim().min(20, "Please explain why you are requesting verification.").max(500),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isVerified: true, isOwner: true, verifiedAt: true },
  });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const request = await prisma.verificationRequest.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, reason: true, adminNote: true, createdAt: true, reviewedAt: true },
  });

  return NextResponse.json({ user, request });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid verification request." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isVerified: true, isOwner: true },
  });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (user.isOwner) return NextResponse.json({ error: "The owner account is already protected." }, { status: 400 });
  if (user.isVerified) return NextResponse.json({ error: "Your account is already verified." }, { status: 409 });

  const latest = await prisma.verificationRequest.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });
  if (latest?.status === "PENDING") return NextResponse.json({ error: "You already have a pending verification request." }, { status: 409 });
  if (latest && latest.status === "REJECTED" && Date.now() - latest.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Please wait 14 days after a rejected request before applying again." }, { status: 429 });
  }

  const created = await prisma.verificationRequest.create({
    data: { userId: user.id, reason: parsed.data.reason },
    select: { id: true, status: true, reason: true, createdAt: true, reviewedAt: true, adminNote: true },
  });

  return NextResponse.json({ request: created }, { status: 201 });
}