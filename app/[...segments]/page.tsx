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

  if (first === "admin") {
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
