import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/admin/login",
  "/two-factor",
]);

export function isPublicPagePath(pathname: string) {
  return PUBLIC_PAGE_PATHS.has(pathname);
}

export function sanitizeNextPath(value: string | null | undefined, fallback = "/home") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/login") || value.startsWith("/signup")) return fallback;
  return value;
}

export function loginRedirectPath(nextPath: string) {
  const safeNextPath = sanitizeNextPath(nextPath, "/home");
  return "/login?next=" + encodeURIComponent(safeNextPath);
}

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(nextPath: string) {
  const session = await getCurrentSession();
  if (!session?.user) redirect(loginRedirectPath(nextPath));
  return session;
}
