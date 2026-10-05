export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}): Promise<Metadata> {
  const { segments } = await params;
  const titles: Record<string, string> = {
    login: "Sign in",
    signup: "Create account",
    discover: "Discover",
    friends: "Friends",
    messages: "Messages",
    notifications: "Notifications",
    settings: "Settings",
    saved: "Saved posts",
  };
  const first = segments[0] ?? "";
  return { title: titles[first] ?? "Socialhub" };
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SocialPages } from "@/components/social-pages";

export default async function CatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { segments } = await params;
  const queryParams = await searchParams;
  const search = Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q;
  const first = segments[0] ?? "";

  if (first === "login" || first === "signup") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) redirect("/home");
    return <SocialPages screen={{ kind: first }} />;
  }

  if (first === "profile") {
    if (segments[1] === "me") {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user) redirect("/login?next=/profile/me");

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { username: true },
      });
      if (!user?.username) redirect("/settings");

      return <SocialPages screen={{ kind: "profile", username: user.username }} />;
    }

    return <SocialPages screen={{ kind: "profile", username: segments[1] ?? "firdous" }} />;
  }


  if (first === "admin") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/login?next=/admin");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true },
    });

    if (!user?.isActive || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      redirect("/home?error=admin");
    }

    return <SocialPages screen={{ kind: "admin", section: segments[1] ?? "control" }} />;
  }

  const map: Record<string, string> = {
    discover: "discover",
    friends: "friends",
    messages: "messages",
    notifications: "notifications",
    settings: "settings",
  };

  if (!map[first]) notFound();

  return <SocialPages screen={{ kind: map[first], search }} />;
}
