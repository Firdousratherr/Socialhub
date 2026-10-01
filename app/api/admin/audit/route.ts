import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const action = (url.searchParams.get("action") ?? "").trim().slice(0, 80);
  const targetType = (url.searchParams.get("targetType") ?? "").trim().slice(0, 40);
  const adminId = (url.searchParams.get("adminId") ?? "").trim();
  const takeParam = Number(url.searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(Math.floor(takeParam), 1), 100) : 50;

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(targetType ? { targetType: { equals: targetType, mode: "insensitive" } } : {}),
      ...(adminId ? { adminId } : {}),
      ...(q ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { targetType: { contains: q, mode: "insensitive" } },
          { targetId: { contains: q, mode: "insensitive" } },
          { details: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({ logs });
}
