import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentSession } from "@/lib/route-access";
import { sanitizeNextPath } from "@/lib/route-policy";

export const metadata: Metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignupPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (session?.user) redirect("/home");

  const query = await searchParams;
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next;
  return <AuthForm signup nextPath={sanitizeNextPath(requestedNext, "/home")} />;
}
