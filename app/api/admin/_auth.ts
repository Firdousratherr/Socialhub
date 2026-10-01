import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AdminRole = "ADMIN" | "MODERATOR";

async function getCurrentAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { session: null, user: null };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });

  return { session, user };
}

export async function requireAdmin() {
  const { session, user } = await getCurrentAdmin();
  if (!session?.user) {
    return {
      session: null,
      user: null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  if (!user?.isActive || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return {
      session,
      user,
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { session, user: user as { id: string; role: AdminRole; isActive: true }, response: null };
}

export async function requireAdminOnly() {
  const result = await requireAdmin();
  if (result.response) return result;
  if (result.user.role !== "ADMIN") {
    return {
      ...result,
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
    };
  }
  return result;
}
