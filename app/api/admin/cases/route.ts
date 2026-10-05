import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";

const statusSchema = z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]);
const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(60).default("OTHER"),
  priority: prioritySchema.default("MEDIUM"),
  subjectUserId: z.string().min(1).nullable().optional(),
  postId: z.string().min(1).nullable().optional(),
  commentId: z.string().min(1).nullable().optional(),
  conversationId: z.string().min(1).nullable().optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  reason: z.string().trim().max(2000).nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().min(1),
  status: statusSchema.optional(),
  resolution: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminPermission("CASES_MANAGE");
  if (access.response) return access.response;
  const url = new URL(request.url);
  const status = statusSchema.safeParse(url.searchParams.get("status") ?? "").success
    ? statusSchema.parse(url.searchParams.get("status"))
    : undefined;
  const priority = prioritySchema.safeParse(url.searchParams.get("priority") ?? "").success
    ? prioritySchema.parse(url.searchParams.get("priority"))
    : undefined;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const userId = (url.searchParams.get("userId") ?? "").trim();

  const cases = await prisma.adminCase.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(userId ? { subjectUserId: userId } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { reason: { contains: q, mode: "insensitive" } },
          { resolution: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const ids = [...new Set(cases.flatMap((item) => [item.subjectUserId, item.assignedToId, item.createdById].filter(Boolean) as string[]))];
  const people = ids.length ? await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, username: true, image: true, role: true },
  }) : [];
  const personMap = new Map(people.map((person) => [person.id, person]));

  await recordAdminEvent({
    access,
    request,
    action: "VIEW_CASES",
    resource: "CASE",
    reason: q || status || priority || userId ? "Filtered case search." : null,
  });

  return NextResponse.json({
    cases: cases.map((item) => ({
      ...item,
      subjectUser: item.subjectUserId ? personMap.get(item.subjectUserId) ?? null : null,
      assignedTo: item.assignedToId ? personMap.get(item.assignedToId) ?? null : null,
      createdBy: personMap.get(item.createdById) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("CASES_MANAGE");
  if (access.response) return access.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid case." }, { status: 400 });

  const item = await prisma.adminCase.create({
    data: { ...parsed.data, createdById: access.user.id },
  });
  await prisma.adminCaseEvent.create({
    data: { caseId: item.id, actorId: access.user.id, type: "CASE_CREATED", details: JSON.stringify({ title: item.title }) },
  });
  await recordAdminEvent({
    access,
    request,
    action: "CREATE_CASE",
    resource: "CASE",
    resourceId: item.id,
    reason: item.reason,
    riskLevel: item.priority === "CRITICAL" ? "HIGH" : "MEDIUM",
  });
  return NextResponse.json({ case: item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requireAdminPermission("CASES_MANAGE");
  if (access.response) return access.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid case update." }, { status: 400 });
  const existing = await prisma.adminCase.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const { id, ...patch } = parsed.data;
  const terminal = patch.status === "RESOLVED" || patch.status === "DISMISSED";
  const item = await prisma.adminCase.update({
    where: { id },
    data: {
      ...patch,
      resolvedAt: terminal ? new Date() : patch.status ? null : existing.resolvedAt,
    },
  });
  await prisma.adminCaseEvent.create({
    data: {
      caseId: id,
      actorId: access.user.id,
      type: "CASE_UPDATED",
      details: JSON.stringify({ before: existing, after: item }),
    },
  });
  await recordAdminEvent({
    access,
    request,
    action: "UPDATE_CASE",
    resource: "CASE",
    resourceId: id,
    reason: item.resolution ?? item.reason,
    before: existing,
    after: item,
  });
  return NextResponse.json({ case: item });
}
