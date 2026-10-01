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
  const before = url.searchParams.get("before");
  let cursor: { createdAt: Date; id: string } | null = null;
  if (before) {
    try {
      const decoded = JSON.parse(Buffer.from(before, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
      if (!decoded.createdAt || !decoded.id) throw new Error("invalid");
      const createdAt = new Date(decoded.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
      cursor = { createdAt, id: decoded.id };
    } catch { return NextResponse.json({ error: "Invalid audit cursor." }, { status: 400 }); }
  }
  const isCsv = url.searchParams.get("format") === "csv";
  const takeParam = Number(url.searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(Math.floor(takeParam), 1), 100) : 50;

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: isCsv ? 1000 : take + 1,
  });

  const hasMore = logs.length > take;
  const page = logs.slice(0, take);
  const oldest = page.at(-1);
  const nextBefore = hasMore && oldest ? Buffer.from(JSON.stringify({ createdAt: oldest.createdAt.toISOString(), id: oldest.id })).toString("base64url") : null;

  if (isCsv) {
    const escape = (value: string | null | undefined) => "\"" + String(value ?? "").replace(/\"/g, "\"\"") + "\"";
    const csv = ["createdAt,adminId,action,targetType,targetId,details", ...page.map((log) => [log.createdAt.toISOString(), log.adminId, log.action, log.targetType, log.targetId, log.details].map(escape).join(","))].join("\\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=admin-audit.csv" } });
  }

  return NextResponse.json({ logs: page, nextBefore });
}
