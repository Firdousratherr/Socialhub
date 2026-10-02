import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizedEmail(body?.email);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid account email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "No Socialhub account is registered with this email address." },
      { status: 404 },
    );
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
