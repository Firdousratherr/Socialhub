import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizedEmail(body?.email);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid account email address." }, { status: 400 });
  }

  const rateKey = createHash("sha256")
    .update(email + "|" + requestAddress(request))
    .digest("hex");
  const key = "password-reset:" + rateKey;
  const now = new Date();
  const resetAt = new Date(now.getTime() + 10 * 60 * 1000);
  const existingAttempt = await prisma.adminLoginAttempt.findUnique({ where: { key } });

  // Apply the same limit to known and unknown addresses without leaking account existence.
  if (existingAttempt && existingAttempt.resetAt > now && existingAttempt.count >= 5) {
    return NextResponse.json({ success: true });
  }

  if (!existingAttempt || existingAttempt.resetAt <= now) {
    await prisma.adminLoginAttempt.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
  } else {
    await prisma.adminLoginAttempt.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true },
  });

  // Always return the same successful response for an unknown account email.
  if (!user) return NextResponse.json({ success: true });

  try {
    await auth.api.requestPasswordResetEmailOTP({
      body: { email: user.email },
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
