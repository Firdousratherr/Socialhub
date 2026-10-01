import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const inputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

export async function POST(request: Request) {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD;

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
  if (isRateLimited(key)) {
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
    select: { id: true },
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
        select: { id: true },
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

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN", isActive: true, emailVerified: true },
    });

    clearAttempts(key);
    return signInResponse;
  } catch {
    return NextResponse.json({ error: "Administrator sign-in failed." }, { status: 500 });
  }
}
