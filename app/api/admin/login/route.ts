import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const inputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientKey(request: Request, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${email}`;
}

async function registerAttempt(key: string) {
  const id = crypto.randomUUID();
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "AdminLoginAttempt" ("id","key","count","resetAt","createdAt","updatedAt")
    VALUES (${id}, ${key}, 1, CURRENT_TIMESTAMP + INTERVAL '5 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AdminLoginAttempt"."resetAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE "AdminLoginAttempt"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "AdminLoginAttempt"."resetAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes'
        ELSE "AdminLoginAttempt"."resetAt"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count"
  `;
  return (rows[0]?.count ?? 0) > 5;
}

async function clearAttempts(key: string) {
  await prisma.adminLoginAttempt.deleteMany({ where: { key } });
}

export async function POST(request: Request) {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const configuredOwnerEmail = (process.env.SOCIALHUB_OWNER_EMAIL?.trim().toLowerCase() || configuredEmail);

  if (!configuredEmail || !configuredPassword) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in Vercel Environment Variables." },
      { status: 503 },
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid admin email and password." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const key = clientKey(request, email);
  if (await registerAttempt(key)) {
    return NextResponse.json(
      { error: "Too many administrator login attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": "300" } },
    );
  }

  if (!safeEqual(email, configuredEmail) || !safeEqual(parsed.data.password, configuredPassword)) {
    return NextResponse.json({ error: "Invalid administrator credentials." }, { status: 401 });
  }

  let user = await prisma.user.findUnique({
    where: { email: configuredEmail },
    select: { id: true, isOwner: true, ownerSince: true },
  });

  if (!user) {
    try {
      const signUpResponse = await auth.api.signUpEmail({
        body: {
          name: process.env.ADMIN_NAME?.trim() || "Administrator",
          email: configuredEmail,
          password: configuredPassword,
        },
        headers: request.headers,
        asResponse: true,
      });

      if (!signUpResponse.ok) {
        const details = await signUpResponse.clone().json().catch(() => null) as { message?: string; error?: string } | null;
        return NextResponse.json(
          { error: details?.message ?? details?.error ?? "Could not create the administrator account." },
          { status: signUpResponse.status },
        );
      }

      user = await prisma.user.findUnique({
        where: { email: configuredEmail },
        select: { id: true, isOwner: true, ownerSince: true },
      });
    } catch {
      return NextResponse.json({ error: "Could not create the administrator account." }, { status: 500 });
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Administrator account could not be created." }, { status: 500 });
  }

  try {
    const signInResponse = await auth.api.signInEmail({
      body: {
        email: configuredEmail,
        password: configuredPassword,
        rememberMe: true,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!signInResponse.ok) {
      const details = await signInResponse.clone().json().catch(() => null) as { message?: string; error?: string } | null;
      return NextResponse.json(
        { error: details?.message ?? details?.error ?? "Administrator sign-in failed." },
        { status: signInResponse.status },
      );
    }

    const shouldOwn = configuredEmail === configuredOwnerEmail;
    const becameOwner = shouldOwn && !user.isOwner;
    const previousOwners = shouldOwn ? await prisma.user.findMany({ where: { isOwner: true, id: { not: user.id } }, select: { id: true } }) : [];
    await prisma.$transaction(async (tx) => {
      if (previousOwners.length) {
        await tx.user.updateMany({ where: { id: { in: previousOwners.map((owner) => owner.id) } }, data: { isOwner: false, ownerSince: null } });
        await tx.verificationAudit.createMany({
          data: previousOwners.map((owner) => ({ userId: owner.id, adminId: user.id, action: "OWNER_REVOKED" as const, reason: "Owner designation moved to the configured owner account." })),
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          role: "ADMIN",
          isActive: true,
          emailVerified: true,
          isOwner: shouldOwn,
          ownerSince: shouldOwn ? (user.ownerSince ?? new Date()) : null,
        },
      });
      if (becameOwner) {
        await tx.verificationAudit.create({
          data: { userId: user.id, adminId: user.id, action: "OWNER_GRANTED", reason: "Configured Socialhub owner account." },
        });
      }
    });

    clearAttempts(key);
    return signInResponse;
  } catch {
    return NextResponse.json({ error: "Administrator sign-in failed." }, { status: 500 });
  }
}
