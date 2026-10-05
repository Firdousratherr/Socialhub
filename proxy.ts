import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/request-security";
import { auth } from "@/lib/auth";
import { isPublicPagePath } from "@/lib/route-access";

export async function proxy(request: NextRequest) {
  const requestId = randomUUID();
  const { pathname, search } = request.nextUrl;
  let response: NextResponse;

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/")) {
    response =
      pathname.startsWith("/api/auth/")
        ? NextResponse.next()
        : requireSameOrigin(request) ?? NextResponse.next();
  } else if (isPublicPagePath(pathname)) {
    response = NextResponse.next();
  } else {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
    response = NextResponse.next();
  }

  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml|ads.txt|manifest.webmanifest).*)"],
};
