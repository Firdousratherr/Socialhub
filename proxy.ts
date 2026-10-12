import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/request-security";
import { auth } from "@/lib/auth";
import { isPublicPagePath } from "@/lib/route-policy";

function contentSecurityPolicy(nonce: string) {
  // Google AdSense recommends a nonce-based strict CSP because its script
  // origins can change over time. Next.js also uses this request header to
  // attach the nonce to framework-generated scripts.
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`,
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "media-src 'self' blob: https:",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const requestId = randomUUID();
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { pathname, search } = request.nextUrl;
  let response: NextResponse;

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/")) {
    response =
      pathname.startsWith("/api/auth/")
        ? NextResponse.next({ request: { headers: requestHeaders } })
        : requireSameOrigin(request) ??
          NextResponse.next({ request: { headers: requestHeaders } });
  } else if (isPublicPagePath(pathname)) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname + search);
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  }

  response.headers.set("X-Request-ID", requestId);
  response.headers.set("Content-Security-Policy", csp);
  // WebRTC calling needs camera/microphone permission on Socialhub itself.
  // Other powerful browser APIs stay disabled unless explicitly needed.
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml|ads.txt|manifest.webmanifest).*)"],
};
