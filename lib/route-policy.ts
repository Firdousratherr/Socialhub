export const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/admin/login",
  "/two-factor",
  "/download",
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
