import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminOnly } from "@/app/api/admin/_auth";
import * as z from "zod";

const statusSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"].includes(status)) {
    return NextResponse.json({ error: "Invalid verification request status." }, { status: 400 });
  }
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
  const where = status === "ALL" ? {} : { status: status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" };
  const requests = await prisma.verificationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true, username: true, email: true, image: true, isVerified: true, isOwner: true } },
      reviewer: { select: { id: true, name: true, username: true } },
    },
  });
  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  const access = await requireAdminOnly();
  if (access.response) return access.response;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification review." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.verificationRequest.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, userId: true, status: true },
    });
    if (!current) throw new Error("NOT_FOUND");
    if (current.status !== "PENDING") throw new Error("ALREADY_REVIEWED");

    const approved = parsed.data.status === "APPROVED";
    const reviewedAt = new Date();
    const updated = await tx.verificationRequest.update({
      where: { id: current.id },
      data: { status: parsed.data.status, reviewerId: access.user.id, adminNote: parsed.data.note || null, reviewedAt },
      select: { id: true, status: true, reason: true, adminNote: true, reviewedAt: true },
    });

    if (approved) {
      await tx.user.update({ where: { id: current.userId }, data: { isVerified: true, verifiedAt: reviewedAt } });
    }

    await tx.verificationAudit.create({
      data: {
        userId: current.userId,
        adminId: access.user.id,
        action: approved ? "GRANTED" : "REVOKED",
        reason: approved ? "Verification request approved by an administrator." : "Verification request rejected by an administrator.",
      },
    });
    await tx.notification.create({
      data: {
        userId: current.userId,
        actorId: access.user.id,
        type: "SYSTEM",
        title: approved ? "Verification approved" : "Verification request reviewed",
        body: approved ? "Your Socialhub account has received the blue verification badge." : (parsed.data.note ? "Your verification request was not approved: " + parsed.data.note : "Your verification request was not approved at this time."),
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: access.user.id,
        action: "UPDATE_USER",
        targetType: "USER",
        targetId: current.userId,
        details: JSON.stringify({ verificationRequestId: current.id, status: parsed.data.status, note: parsed.data.note ?? null }),
      },
    });
    return updated;
  }).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") return null;
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") return "ALREADY_REVIEWED" as const;
    throw error;
  });

  if (result === null) return NextResponse.json({ error: "Verification request not found." }, { status: 404 });
  if (result === "ALREADY_REVIEWED") return NextResponse.json({ error: "That verification request has already been reviewed." }, { status: 409 });
  return NextResponse.json({ request: result });
}