import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SocialPages } from "@/components/social-pages";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/home");

  return <SocialPages screen={{ kind: "login" }} />;
}
