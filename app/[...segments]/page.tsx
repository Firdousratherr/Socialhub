import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SocialPages } from "@/components/social-pages";
import { getCurrentSession, requireUser, sanitizeNextPath } from "@/lib/route-access";

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

export default async function CatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ q?: string | string[]; next?: string | string[] }>;
}) {
  const { segments } = await params;
  const queryParams = await searchParams;
  const search = Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q;
  const nextParam = Array.isArray(queryParams.next) ? queryParams.next[0] : queryParams.next;
  const first = segments[0] ?? "";

  if (first === "login" || first === "signup") {
    const session = await getCurrentSession();
    if (session?.user) redirect("/home");
    return <SocialPages screen={{ kind: first, next: sanitizeNextPath(nextParam, "/home") }} />;
  }

  const pathname = "/" + segments.map((segment) => encodeURIComponent(segment)).join("/");
  const nextPath = sanitizeNextPath(pathname + (search ? "?q=" + encodeURIComponent(search) : ""), "/home");
  const session = await requireUser(nextPath);

  if (first === "profile") {
    if (segments[1] === "me") {
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
