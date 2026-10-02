import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizedEmail(body?.email);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid account email address." }, { status: 400 });
  }

  const rateKey = createHash("sha256")
    .update(email + "|" + (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown"))
    .digest("hex");

  const now = new Date();
  const resetWindow = 10 * 60 * 1000;
  const existingAttempt = await prisma.adminLoginAttempt.findUnique({ where: { key: "password-reset:" + rateKey } });
  if (existingAttempt && existingAttempt.resetAt > now && existingAttempt.count >= 5) {
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    if (!existingAttempt || existingAttempt.resetAt <= now) {
      await prisma.adminLoginAttempt.upsert({
        where: { key: "password-reset:" + rateKey },
        update: { count: 1, resetAt: new Date(now.getTime() + resetWindow) },
        create: { key: "password-reset:" + rateKey, count: 1, resetAt: new Date(now.getTime() + resetWindow) },
      });
    }
    return NextResponse.json({ success: true });
  }

  if (!existingAttempt || existingAttempt.resetAt <= now) {
    await prisma.adminLoginAttempt.upsert({
      where: { key: "password-reset:" + rateKey },
      update: { count: 1, resetAt: new Date(now.getTime() + resetWindow) },
      create: { key: "password-reset:" + rateKey, count: 1, resetAt: new Date(now.getTime() + resetWindow) },
    });
  } else {
    await prisma.adminLoginAttempt.update({
      where: { key: "password-reset:" + rateKey },
      data: { count: { increment: 1 } },
    });
  }

  try {
    await auth.api.requestPasswordResetEmailOTP({
      body: { email },
      headers: request.headers,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Socialhub password reset OTP request failed", error);
    return NextResponse.json(
      { error: "We could not send the reset code. Please try again." },
      { status: 500 },
    );
  }
}
