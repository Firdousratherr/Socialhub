import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "PARTIAL"]),
  reviewerNote: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminPermission("CASES_MANAGE");
  if (access.response) return access.response;
  const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
  const allowed = new Set(["PENDING", "APPROVED", "REJECTED", "PARTIAL"]);
  if (!allowed.has(status)) return NextResponse.json({ error: "Invalid appeal status." }, { status: 400 });
  const appeals = await prisma.adminAppeal.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100 });
  const ids = [...new Set([...appeals.map((x) => x.userId), ...appeals.map((x) => x.reviewerId).filter(Boolean) as string[]])];
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, username: true, image: true, isActive: true, role: true } }) : [];
  const map = new Map(people.map((p) => [p.id, p]));
  await recordAdminEvent({ access, request, action: "VIEW_APPEALS", resource: "APPEAL" });
  return NextResponse.json({ appeals: appeals.map((x) => ({ ...x, user: map.get(x.userId) ?? null, reviewer: x.reviewerId ? map.get(x.reviewerId) ?? null : null })) });
}

export async function PATCH(request: Request) {
  const access = await requireAdminPermission("CASES_MANAGE");
  if (access.response) return access.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid appeal decision." }, { status: 400 });
  const existing = await prisma.adminAppeal.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Appeal not found." }, { status: 404 });
  const item = await prisma.adminAppeal.update({ where: { id: existing.id }, data: { status: parsed.data.status, reviewerId: access.user.id, reviewerNote: parsed.data.reviewerNote ?? null, reviewedAt: new Date() } });

  if (parsed.data.status === "APPROVED" || parsed.data.status === "PARTIAL") {
    await prisma.user.update({
      where: { id: item.userId },
      data: parsed.data.status === "APPROVED"
        ? {
            isActive: true,
            suspensionReason: null,
            suspendedUntil: null,
            postingRestrictedUntil: null,
            commentingRestrictedUntil: null,
            messagingRestrictedUntil: null,
            socialRestrictedUntil: null,
          }
        : { isActive: true, suspensionReason: null, suspendedUntil: null },
    });
    await prisma.adminEnforcementAction.create({
      data: {
        subjectUserId: item.userId,
        actorId: access.user.id,
        caseId: item.caseId,
        action: parsed.data.status === "APPROVED" ? "APPEAL_FULL_RESTORE" : "APPEAL_PARTIAL_RELIEF",
        reason: item.reviewerNote?.trim() || "Appeal relief granted.",
      },
    });
    await prisma.notification.create({
      data: {
        userId: item.userId,
        actorId: access.user.id,
        type: "SYSTEM",
        title: parsed.data.status === "APPROVED" ? "Appeal approved" : "Partial appeal relief granted",
        body: parsed.data.status === "APPROVED" ? "Your account restrictions were removed after appeal review." : "Your suspension was removed after appeal review; some restrictions may remain.",
      },
    });
  }

  if (item.caseId && parsed.data.status !== "REJECTED") {
    await prisma.adminCaseEvent.create({ data: { caseId: item.caseId, actorId: access.user.id, type: "APPEAL_REVIEWED", details: JSON.stringify({ appealId: item.id, status: item.status }) } });
  }
  await recordAdminEvent({ access, request, action: "REVIEW_APPEAL", resource: "APPEAL", resourceId: item.id, reason: item.reviewerNote, riskLevel: "HIGH", before: existing, after: item });
  return NextResponse.json({ appeal: item });
}
