import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { hasAdminPermission, requireAdminPermission } from "@/lib/admin-permissions";
import { requireAdmin } from "@/app/api/admin/_auth";
import { recordAdminEvent } from "@/lib/admin-operations";
import { APP_DOWNLOAD_SETTING_KEY, isDirectApkUrl } from "@/lib/app-download";

const settingSchema = z.object({ key: z.string().trim().regex(/^[A-Za-z0-9_.-]{2,80}$/), value: z.string().max(10000), description: z.string().max(300).nullable().optional() });
const flagSchema = z.object({ key: z.string().trim().regex(/^[A-Za-z0-9_.-]{2,80}$/), enabled: z.boolean(), description: z.string().max(300).nullable().optional() });
const announcementSchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(5000), audience: z.string().trim().max(40).default("ALL"), status: z.enum(["DRAFT","PUBLISHED","ARCHIVED"]).default("DRAFT"), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() });

export async function GET() {
  const access = await requireAdmin();
  if (access.response) return access.response;

  const [canReadSettings, canReadFlags, canReadAnnouncements, canReadSecurity] = await Promise.all([
    hasAdminPermission(access.user.id, access.user.role, "PLATFORM_SETTINGS"),
    hasAdminPermission(access.user.id, access.user.role, "FEATURE_FLAGS"),
    hasAdminPermission(access.user.id, access.user.role, "ANNOUNCEMENTS"),
    hasAdminPermission(access.user.id, access.user.role, "SECURITY_MANAGE"),
  ]);

  const [
    settings,
    flags,
    announcements,
    adminSessions,
    failedAttempts,
    admins,
    flagChanges,
    settingChanges,
  ] = await Promise.all([
    canReadSettings ? prisma.systemSetting.findMany({ orderBy: { key: "asc" } }) : Promise.resolve([]),
    canReadFlags ? prisma.featureFlag.findMany({ orderBy: { key: "asc" } }) : Promise.resolve([]),
    canReadAnnouncements
      ? prisma.announcement.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, title: true, body: true, audience: true, status: true,
            startsAt: true, endsAt: true, createdAt: true, updatedAt: true,
            createdBy: { select: { id: true, name: true, username: true } },
          },
        })
      : Promise.resolve([]),
    canReadSecurity
      ? prisma.session.findMany({
          where: { user: { role: { in: ["ADMIN", "MODERATOR"] }, isActive: true } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true, userId: true, createdAt: true, updatedAt: true, expiresAt: true,
            ipAddress: true, userAgent: true,
            user: { select: { id: true, name: true, username: true, role: true } },
          },
        })
      : Promise.resolve([]),
    canReadSecurity
      ? prisma.adminLoginAttempt.findMany({ orderBy: { updatedAt: "desc" }, take: 50 })
      : Promise.resolve([]),
    canReadSecurity
      ? prisma.user.findMany({
          where: { role: { in: ["ADMIN", "MODERATOR"] } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true, name: true, username: true, email: true, role: true,
            isActive: true, isOwner: true, twoFactorEnabled: true,
          },
        })
      : Promise.resolve([]),
    canReadFlags ? prisma.adminFlagChange.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
    canReadSettings ? prisma.adminSettingChange.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    settings,
    flags,
    announcements,
    adminSessions,
    failedAttempts,
    admins,
    flagChanges,
    settingChanges,
    currentAdminId: access.user.id,
    capabilities: {
      settings: canReadSettings,
      featureFlags: canReadFlags,
      announcements: canReadAnnouncements,
      security: canReadSecurity,
    },
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  const permission = kind === "setting" ? "PLATFORM_SETTINGS" : kind === "flag" ? "FEATURE_FLAGS" : kind === "announcement" || kind === "announcement.update" ? "ANNOUNCEMENTS" : "PLATFORM_SETTINGS";
  const access = await requireAdminPermission(permission);
  if (access.response) return access.response;
  if (kind === "setting") {
    const parsed = settingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid setting." }, { status:400 });
    if (parsed.data.key === APP_DOWNLOAD_SETTING_KEY && !isDirectApkUrl(parsed.data.value)) {
      return NextResponse.json({ error: "Enter a direct HTTPS download URL whose path ends in .apk." }, { status: 400 });
    }
    const before = await prisma.systemSetting.findUnique({ where:{key:parsed.data.key} });
    const setting = await prisma.systemSetting.upsert({ where:{key:parsed.data.key}, create:{...parsed.data,updatedById:access.user.id}, update:{value:parsed.data.value,description:parsed.data.description,updatedById:access.user.id} });
    await prisma.adminSettingChange.create({
      data: { settingKey: setting.key, actorId: access.user.id, before: before?.value ?? null, after: setting.value, reason: parsed.data.description ?? null },
    });
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"UPDATE_SYSTEM_SETTING",targetType:"SETTING",targetId:setting.key,details:JSON.stringify({before,after:setting})}});
    await recordAdminEvent({ access, request, action: "UPDATE_SYSTEM_SETTING", resource: "SETTING", resourceId: setting.key, permission: "PLATFORM_SETTINGS", before: before?.value ?? null, after: setting.value, reason: parsed.data.description ?? null, riskLevel: setting.key.startsWith("platform.") ? "HIGH" : "MEDIUM" });
    return NextResponse.json({setting});
  }
  if (kind === "flag") {
    const parsed = flagSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid feature flag." }, { status:400 });
    const before = await prisma.featureFlag.findUnique({ where:{key:parsed.data.key} });
    const flag = await prisma.featureFlag.upsert({ where:{key:parsed.data.key}, create:{...parsed.data,updatedById:access.user.id}, update:{enabled:parsed.data.enabled,description:parsed.data.description,updatedById:access.user.id} });
    await prisma.adminFlagChange.create({
      data: { flagKey: flag.key, actorId: access.user.id, before: before?.enabled ?? false, after: flag.enabled, reason: parsed.data.description ?? null },
    });
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"UPDATE_FEATURE_FLAG",targetType:"FEATURE_FLAG",targetId:flag.key,details:JSON.stringify({before,after:flag})}});
    await recordAdminEvent({ access, request, action: "UPDATE_FEATURE_FLAG", resource: "FEATURE_FLAG", resourceId: flag.key, permission: "FEATURE_FLAGS", before: before?.enabled ?? false, after: flag.enabled, reason: parsed.data.description ?? null, riskLevel: "HIGH" });
    return NextResponse.json({flag});
  }
  if (kind === "announcement") {
    const parsed = announcementSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid announcement." }, { status:400 });
    const item = await prisma.announcement.create({data:{...parsed.data,startsAt:parsed.data.startsAt?new Date(parsed.data.startsAt):null,endsAt:parsed.data.endsAt?new Date(parsed.data.endsAt):null,createdById:access.user.id}});
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"CREATE_ANNOUNCEMENT",targetType:"ANNOUNCEMENT",targetId:item.id,details:JSON.stringify({title:item.title,status:item.status,audience:item.audience})}});
    return NextResponse.json({announcement:item});
  }
  if (kind === "announcement.update") {
    const parsed = announcementSchema.partial().extend({ id: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid announcement update." }, { status: 400 });
    const { id, ...patch } = parsed.data;
    const before = await prisma.announcement.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    const item = await prisma.announcement.update({
      where: { id },
      data: {
        ...patch,
        ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt ? new Date(patch.startsAt) : null } : {}),
        ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt ? new Date(patch.endsAt) : null } : {}),
      },
    });
    await prisma.adminAuditLog.create({ data: { adminId: access.user.id, action: "UPDATE_ANNOUNCEMENT", targetType: "ANNOUNCEMENT", targetId: id, details: JSON.stringify({ before, after: item }) } });
    return NextResponse.json({ announcement: item });
  }
  return NextResponse.json({error:"Unknown control operation."},{status:400});
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  const permission = type === "session" ? "SECURITY_MANAGE" : type === "announcement" ? "ANNOUNCEMENTS" : "PLATFORM_SETTINGS";
  const access = await requireAdminPermission(permission);
  if (access.response) return access.response;
  if (type === "session" && id) {
    const target = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        user: { select: { role: true, isOwner: true } },
      },
    });
    if (!target) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (target.userId === access.user.id) {
      return NextResponse.json({ error: "Use your own Security screen to manage your current account sessions." }, { status: 400 });
    }
    if (target.user.isOwner) {
      return NextResponse.json({ error: "The owner account's sessions cannot be revoked by another administrator." }, { status: 403 });
    }
    if (target.user.role === "ADMIN" && access.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only an administrator can revoke another administrator's session." }, { status: 403 });
    }
    await prisma.session.delete({where:{id}});
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"REVOKE_ADMIN_SESSION",targetType:"SESSION",targetId:id,details:JSON.stringify({userId:target.userId})}});
    return NextResponse.json({ok:true});
  }
  if (type === "announcement" && id) {
    await prisma.announcement.delete({where:{id}}).catch(()=>null);
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"DELETE_ANNOUNCEMENT",targetType:"ANNOUNCEMENT",targetId:id}});
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Unknown delete operation."},{status:400});
}
