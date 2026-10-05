import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
  }

  const data: Partial<Record<PreferenceKey, boolean>> = {};
  for (const key of keys) {
    if (key in body) {
      if (typeof body[key] !== "boolean") {
        return NextResponse.json({ error: `Preference "${key}" must be a boolean.` }, { status: 400 });
      }
      data[key] = body[key];
    }
  }

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
