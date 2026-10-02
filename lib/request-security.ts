import { NextResponse } from "next/server";

export function requireSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (["GET","HEAD","OPTIONS"].includes(method)) return null;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const parsed = new URL(origin);
      if (parsed.host === host) return null;
    } catch {}
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return null;

  return NextResponse.json({ error: "Cross-origin state-changing requests are not allowed." }, { status: 403 });
}
