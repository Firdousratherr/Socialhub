import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  token: z.string().trim().min(32).max(256),
});

function tokenMatches(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to bootstrap the first administrator." }, { status: 401 });
  }

  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!bootstrapToken) {
    return NextResponse.json({ error: "Admin bootstrap is not configured." }, { status: 503 });
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (existingAdmin) {
    return NextResponse.json({ error: "Admin bootstrap has already been completed." }, { status: 409 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !tokenMatches(parsed.data.token, bootstrapToken)) {
    return NextResponse.json({ error: "Invalid bootstrap token." }, { status: 403 });
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: session.user.id },
      data: { role: "ADMIN", isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: updated.id,
        action: "BOOTSTRAP_ADMIN",
        targetType: "USER",
        targetId: updated.id,
      },
    });

    return updated;
  });

  return NextResponse.json({ success: true, user });
}
