import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";
import { consumeMutationRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const keys = [
  "likes",
  "comments",
  "follows",
  "friendRequests",
  "friendAccepted",
  "messages",
  "mentions",
  "shares",
  "system",
  "storyReplies",
  "storyReactions",
] as const;

type PreferenceKey = (typeof keys)[number];

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });

  return NextResponse.json({
    preferences: Object.fromEntries(keys.map((key) => [key, preferences[key]])),
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const limit = await consumeMutationRateLimit("notification-preferences", request, session.user.id, 30, 3600);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const preferenceSchema = z.object(
    Object.fromEntries(keys.map((key) => [key, z.boolean().optional()])) as Record<PreferenceKey, z.ZodOptional<z.ZodBoolean>>,
  );
  const body = await request.json().catch(() => null);
  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification preferences." }, { status: 400 });

  const data = parsed.data as Partial<Record<PreferenceKey, boolean>>;

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No preferences supplied." }, { status: 400 });
  }

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json({
    preferences: Object.fromEntries(keys.map((key) => [key, preferences[key]])),
  });
}
