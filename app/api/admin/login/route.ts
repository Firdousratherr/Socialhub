import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

const inputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

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
  if (email !== configuredEmail || parsed.data.password !== configuredPassword) {
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

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", isActive: true, emailVerified: true },
  });

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

    return signInResponse;
  } catch {
    return NextResponse.json({ error: "Administrator sign-in failed." }, { status: 500 });
  }
}
