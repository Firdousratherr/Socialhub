import { toNextJsHandler } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;

  // Resolve the canonical stored email before Better Auth verifies a reset OTP.
  // This avoids rejecting valid codes when a user enters a different letter case.
  if (pathname.endsWith("/email-otp/reset-password")) {
    const body = await request.clone().json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (email) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { email: true },
      });

      if (user) {
        const normalizedRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify({ ...body, email: user.email }),
        });
        return handlers.POST(normalizedRequest);
      }
    }
  }

  return handlers.POST(request);
}
