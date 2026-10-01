import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminBootstrap } from "@/components/admin-bootstrap";
import { SocialPages } from "@/components/social-pages";

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const first = segments[0] ?? "";

  if (first === "login" || first === "signup") {
    return <SocialPages screen={{ kind: first }} />;
  }

  if (first === "profile") {
    return <SocialPages screen={{ kind: "profile", username: segments[1] ?? "firdous" }} />;
  }

  if (first === "admin" && segments[1] === "setup") {
    return <AdminBootstrap />;
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

    return <SocialPages screen={{ kind: "admin", section: segments[1] ?? "overview" }} />;
  }

  const map: Record<string, string> = {
    discover: "discover",
    friends: "friends",
    messages: "messages",
    notifications: "notifications",
    settings: "settings",
  };

  return <SocialPages screen={{ kind: map[first] ?? "fallback" }} />;
}
