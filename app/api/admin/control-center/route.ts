import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";

const settingSchema = z.object({ key: z.string().trim().regex(/^[A-Za-z0-9_.-]{2,80}$/), value: z.string().max(10000), description: z.string().max(300).nullable().optional() });
const flagSchema = z.object({ key: z.string().trim().regex(/^[A-Za-z0-9_.-]{2,80}$/), enabled: z.boolean(), description: z.string().max(300).nullable().optional() });
const announcementSchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(5000), audience: z.string().trim().max(40).default("ALL"), status: z.enum(["DRAFT","PUBLISHED","ARCHIVED"]).default("DRAFT"), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() });

export async function GET() {
  const access = await requireAdminPermission("SECURITY_MANAGE");
  if (access.response) return access.response;
  const [settings, flags, announcements, adminSessions, failedAttempts, admins] = await Promise.all([
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.featureFlag.findMany({ orderBy: { key: "asc" } }),
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id:true,title:true,body:true,audience:true,status:true,startsAt:true,endsAt:true,createdAt:true,updatedAt:true,createdBy:{select:{id:true,name:true,username:true}} } }),
    prisma.session.findMany({ where: { user: { role: { in: ["ADMIN","MODERATOR"] }, isActive: true } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id:true,userId:true,createdAt:true,updatedAt:true,expiresAt:true,ipAddress:true,userAgent:true,user:{select:{id:true,name:true,username:true,role:true}} } }),
    prisma.adminLoginAttempt.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN","MODERATOR"] } }, orderBy: { createdAt: "asc" }, select: { id:true,name:true,username:true,email:true,role:true,isActive:true,isOwner:true } }),
  ]);
  return NextResponse.json({ settings, flags, announcements, adminSessions, failedAttempts, admins, currentAdminId: access.user.id });
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
    const before = await prisma.systemSetting.findUnique({ where:{key:parsed.data.key} });
    const setting = await prisma.systemSetting.upsert({ where:{key:parsed.data.key}, create:{...parsed.data,updatedById:access.user.id}, update:{value:parsed.data.value,description:parsed.data.description,updatedById:access.user.id} });
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"UPDATE_SYSTEM_SETTING",targetType:"SETTING",targetId:setting.key,details:JSON.stringify({before,after:setting})}});
    return NextResponse.json({setting});
  }
  if (kind === "flag") {
    const parsed = flagSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error:"Invalid feature flag." }, { status:400 });
    const before = await prisma.featureFlag.findUnique({ where:{key:parsed.data.key} });
    const flag = await prisma.featureFlag.upsert({ where:{key:parsed.data.key}, create:{...parsed.data,updatedById:access.user.id}, update:{enabled:parsed.data.enabled,description:parsed.data.description,updatedById:access.user.id} });
    await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"UPDATE_FEATURE_FLAG",targetType:"FEATURE_FLAG",targetId:flag.key,details:JSON.stringify({before,after:flag})}});
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
    const target = await prisma.session.findUnique({where:{id},select:{id:true,userId:true}});
    if (!target) return NextResponse.json({error:"Session not found."},{status:404});
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
