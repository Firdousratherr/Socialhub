import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const method = request.method.toUpperCase();
  if (["GET","HEAD","OPTIONS"].includes(method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host === host) return NextResponse.next();
    } catch {}
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return NextResponse.next();

  return NextResponse.json({ error: "Cross-origin state-changing requests are not allowed." }, { status: 403 });
}

export const config = {
  matcher: ["/api/:path*"],
};
