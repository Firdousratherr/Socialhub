import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const keys = ["showFriendsList","showFollowersList","showFollowingList","allowMessagesEveryone","allowFriendRequests"] as const;
type Key = typeof keys[number];

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const current = await getSession();
  if (!current?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const settings = await prisma.userPrivacySetting.upsert({
    where: { userId: current.user.id },
    create: { userId: current.user.id },
    update: {},
  });
  return NextResponse.json({ settings: Object.fromEntries(keys.map((key) => [key, settings[key]])) });
}

export async function PATCH(request: Request) {
  const current = await getSession();
  if (!current?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid privacy settings." }, { status: 400 });

  const data: Partial<Record<Key, boolean>> = {};
  for (const key of keys) {
    if (key in body) {
      if (typeof body[key] !== "boolean") return NextResponse.json({ error: "Privacy setting must be boolean." }, { status: 400 });
      data[key] = body[key];
    }
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "No privacy settings supplied." }, { status: 400 });

  const settings = await prisma.userPrivacySetting.upsert({
    where: { userId: current.user.id },
    create: { userId: current.user.id, ...data },
    update: data,
  });
  return NextResponse.json({ settings: Object.fromEntries(keys.map((key) => [key, settings[key]])) });
}
