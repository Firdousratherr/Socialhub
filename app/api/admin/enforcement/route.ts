import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { durationToExpiry, recordAdminEvent } from "@/lib/admin-operations";

const actionSchema = z.enum([
  "WARN",
  "RESTRICT_POSTING",
  "RESTRICT_COMMENTING",
  "RESTRICT_MESSAGING",
  "RESTRICT_SOCIAL",
  "SUSPEND",
  "DISABLE",
  "RESTORE",
  "FORCE_PASSWORD_RESET",
  "REVOKE_SESSIONS",
  "VERIFY",
  "UNVERIFY",
]);

const schema = z.object({
  userId: z.string().min(1),
  action: actionSchema,
  reason: z.string().trim().min(2).max(1000),
  durationMinutes: z.number().int().min(0).max(525600).nullable().optional(),
  caseId: z.string().min(1).nullable().optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminPermission("ENFORCEMENT_MANAGE");
  if (access.response) return access.response;
  const userId = (new URL(request.url).searchParams.get("userId") ?? "").trim();
  if (!userId) return NextResponse.json({ error: "User id is required." }, { status: 400 });
  const actions = await prisma.adminEnforcementAction.findMany({
    where: { subjectUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  await recordAdminEvent({ access, request, action: "VIEW_ENFORCEMENT_HISTORY", resource: "USER", resourceId: userId });
  return NextResponse.json({ actions });
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("ENFORCEMENT_MANAGE");
  if (access.response) return access.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid enforcement action." }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true, name: true, email: true, role: true, isOwner: true, isActive: true,
      postingRestrictedUntil: true, commentingRestrictedUntil: true, messagingRestrictedUntil: true, socialRestrictedUntil: true,
      suspendedUntil: true, isVerified: true, forcePasswordResetAt: true,
    },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.isOwner && target.id !== access.user.id) return NextResponse.json({ error: "Owner accounts are protected." }, { status: 403 });
  if (target.id === access.user.id && ["DISABLE", "SUSPEND"].includes(parsed.data.action)) return NextResponse.json({ error: "You cannot suspend or disable your own account." }, { status: 400 });
  if (target.role === "ADMIN" && access.user.role !== "ADMIN") return NextResponse.json({ error: "Moderators cannot enforce against administrators." }, { status: 403 });

  const expiry = durationToExpiry(parsed.data.durationMinutes);
  const action = parsed.data.action;
  const before = target;

  const data: Record<string, unknown> = {};
  if (action === "RESTRICT_POSTING") data.postingRestrictedUntil = expiry;
  if (action === "RESTRICT_COMMENTING") data.commentingRestrictedUntil = expiry;
  if (action === "RESTRICT_MESSAGING") data.messagingRestrictedUntil = expiry;
  if (action === "RESTRICT_SOCIAL") data.socialRestrictedUntil = expiry;
  if (action === "SUSPEND") {
    data.isActive = false;
    data.suspensionReason = parsed.data.reason;
    data.suspendedUntil = expiry;
  }
  if (action === "DISABLE") {
    data.isActive = false;
    data.suspensionReason = parsed.data.reason;
    data.suspendedUntil = null;
  }
  if (action === "RESTORE") {
    Object.assign(data, {
      isActive: true,
      suspensionReason: null,
      suspendedUntil: null,
      postingRestrictedUntil: null,
      commentingRestrictedUntil: null,
      messagingRestrictedUntil: null,
      socialRestrictedUntil: null,
      forcePasswordResetAt: null,
    });
  }
  if (action === "FORCE_PASSWORD_RESET") data.forcePasswordResetAt = new Date();
  if (action === "VERIFY") { data.isVerified = true; }
  if (action === "UNVERIFY") { data.isVerified = false; }
  
  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: target.id }, data });
  }
  if (action === "REVOKE_SESSIONS" || action === "DISABLE" || action === "SUSPEND" || action === "RESTORE") {
    await prisma.session.deleteMany({ where: { userId: target.id } });
  }

  if (action === "WARN") {
    await prisma.notification.create({
      data: {
        userId: target.id,
        actorId: access.user.id,
        type: "SYSTEM",
        title: "Notice from Socialhub",
        body: parsed.data.reason,
      },
    });
  }

  const after = await prisma.user.findUnique({
    where: { id: target.id },
    select: {
      id: true, isActive: true, suspensionReason: true, suspendedUntil: true,
      postingRestrictedUntil: true, commentingRestrictedUntil: true, messagingRestrictedUntil: true,
      socialRestrictedUntil: true, forcePasswordResetAt: true, isVerified: true,
    },
  });

  const record = await prisma.adminEnforcementAction.create({
    data: {
      subjectUserId: target.id,
      actorId: access.user.id,
      caseId: parsed.data.caseId ?? null,
      action,
      reason: parsed.data.reason,
      expiresAt: expiry,
      metadata: JSON.stringify({ durationMinutes: parsed.data.durationMinutes ?? null }),
    },
  });

  if (parsed.data.caseId) {
    await prisma.adminCaseEvent.create({
      data: {
        caseId: parsed.data.caseId,
        actorId: access.user.id,
        type: "ENFORCEMENT_APPLIED",
        details: JSON.stringify({ action, userId: target.id, enforcementId: record.id }),
      },
    });
  }

  await recordAdminEvent({
    access,
    request,
    action: "ENFORCEMENT_" + action,
    resource: "USER",
    resourceId: target.id,
    caseId: parsed.data.caseId,
    reason: parsed.data.reason,
    riskLevel: ["DISABLE", "SUSPEND", "RESTORE", "VERIFY", "UNVERIFY"].includes(action) ? "HIGH" : "MEDIUM",
    before,
    after,
  });

  return NextResponse.json({ success: true, action: record, user: after });
}
