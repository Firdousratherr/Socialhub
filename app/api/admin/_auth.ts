import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!user?.isActive || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return {
      session,
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { session, user, response: null };
}
