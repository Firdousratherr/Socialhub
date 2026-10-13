import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/home");

  return <AuthForm />;
}
