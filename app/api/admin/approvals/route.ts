import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

const createSchema = z.object({
  action: z.string().trim().min(2).max(80),
  targetType: z.string().trim().min(2).max(40),
  targetId: z.string().trim().min(1).max(120),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().trim().min(2).max(1000),
});
const decisionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminPermission("APPROVALS_MANAGE");
  if (access.response) return access.response;
  const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
  const approvals = await prisma.adminApprovalRequest.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100 });
  await recordAdminEvent({ access, request, action: "VIEW_APPROVALS", resource: "APPROVAL" });
  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("APPROVALS_MANAGE");
  if (access.response) return access.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  const item = await prisma.adminApprovalRequest.create({
    data: {
      requesterId: access.user.id,
      action: parsed.data.action,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      payload: parsed.data.payload ? JSON.stringify(parsed.data.payload) : null,
      reason: parsed.data.reason,
    },
  });
  await recordAdminEvent({ access, request, action: "CREATE_APPROVAL_REQUEST", resource: "APPROVAL", resourceId: item.id, reason: item.reason, riskLevel: "HIGH" });
  return NextResponse.json({ approval: item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requireAdminPermission("APPROVALS_MANAGE");
  if (access.response) return access.response;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval decision." }, { status: 400 });
  const existing = await prisma.adminApprovalRequest.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
  if (existing.requesterId === access.user.id) return NextResponse.json({ error: "The requester cannot approve their own request." }, { status: 403 });
  if (existing.status !== "PENDING") return NextResponse.json({ error: "Approval request is already decided." }, { status: 409 });
  const item = await prisma.adminApprovalRequest.update({ where: { id: existing.id }, data: { status: parsed.data.status, approverId: access.user.id, decisionNote: parsed.data.decisionNote ?? null, decidedAt: new Date() } });
  await recordAdminEvent({ access, request, action: "DECIDE_APPROVAL", resource: "APPROVAL", resourceId: item.id, reason: item.decisionNote, riskLevel: "CRITICAL", before: existing, after: item });
  return NextResponse.json({ approval: item });
}
