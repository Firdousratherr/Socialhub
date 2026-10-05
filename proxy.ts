import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/request-security";

export function proxy(request: NextRequest) {
  const requestId = randomUUID();
  const response =
    request.nextUrl.pathname.startsWith("/api/auth/") || !request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.next()
      : requireSameOrigin(request) ?? NextResponse.next();

  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
