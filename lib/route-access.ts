import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginRedirectPath } from "@/lib/route-policy";

export { isPublicPagePath, PUBLIC_PAGE_PATHS, sanitizeNextPath } from "@/lib/route-policy";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(nextPath: string) {
  const session = await getCurrentSession();
  if (!session?.user) redirect(loginRedirectPath(nextPath));
  return session;
}
