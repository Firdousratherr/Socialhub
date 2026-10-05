import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type AdminAccess = {
  user: { id: string; role: "ADMIN" | "MODERATOR"; isOwner: boolean };
  session?: { session?: { id?: string } | null } | null;
};

export async function recordAdminEvent(input: {
  access: AdminAccess;
  request?: Request;
  action: string;
  resource: string;
  resourceId?: string | null;
  caseId?: string | null;
  permission?: string | null;
  reason?: string | null;
  outcome?: "SUCCESS" | "FAILED" | "BLOCKED";
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  before?: unknown;
  after?: unknown;
}) {
  const headersList = input.request?.headers ?? (await headers());
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    null;
  const userAgent = headersList.get("user-agent");
  const sessionId =
    input.access.session && "session" in input.access.session
      ? ((input.access.session as { session?: { id?: string } | null }).session?.id ?? null)
      : null;

  return prisma.adminAuditEvent.create({
    data: {
      actorId: input.access.user.id,
      actorRole: input.access.user.role,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      caseId: input.caseId ?? null,
      reason: input.reason ?? null,
      permission: input.permission ?? null,
      outcome: input.outcome ?? "SUCCESS",
      riskLevel: input.riskLevel ?? "LOW",
      before: input.before == null ? null : JSON.stringify(input.before),
      after: input.after == null ? null : JSON.stringify(input.after),
      ipAddress,
      userAgent,
      sessionId,
    },
  });
}

export function durationToExpiry(minutes?: number | null) {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + Math.min(minutes, 60 * 24 * 365) * 60_000);
}
