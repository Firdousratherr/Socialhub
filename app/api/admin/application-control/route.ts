import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminEvent } from "@/lib/admin-operations";
import {
  APP_DOWNLOAD_SETTING_KEY,
  DEFAULT_ANDROID_APK_URL,
  isDirectApkUrl,
} from "@/lib/app-download";

const PLATFORM_CONTROLS = [
  {
    key: "registration.enabled",
    label: "New registrations",
    description: "Allow new users to create Socialhub accounts.",
    defaultEnabled: true,
  },
  {
    key: "platform.posts.enabled",
    label: "Posts",
    description: "Allow people to create and publish posts.",
    defaultEnabled: true,
  },
  {
    key: "platform.comments.enabled",
    label: "Comments",
    description: "Allow people to add comments to posts.",
    defaultEnabled: true,
  },
  {
    key: "platform.messaging.enabled",
    label: "Direct messages",
    description: "Allow people to access direct-message conversations and send messages.",
    defaultEnabled: true,
  },
  {
    key: "platform.uploads.enabled",
    label: "Media uploads",
    description: "Allow people to upload images and other supported media.",
    defaultEnabled: true,
  },
  {
    key: "platform.stories.enabled",
    label: "Stories",
    description: "Allow people to create stories. Existing stories remain available when creation is disabled.",
    defaultEnabled: true,
  },
  {
    key: "platform.social.enabled",
    label: "Social connections",
    description: "Allow follow actions and friend requests.",
    defaultEnabled: true,
  },
] as const;

const platformKeySchema = z.enum([
  "registration.enabled",
  "platform.posts.enabled",
  "platform.comments.enabled",
  "platform.messaging.enabled",
  "platform.uploads.enabled",
  "platform.stories.enabled",
  "platform.social.enabled",
]);

const patchSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("platform"),
    key: platformKeySchema,
    enabled: z.boolean(),
    reason: z.string().trim().max(240).optional(),
  }),
  z.object({
    kind: z.literal("apk"),
    value: z.string().trim().min(1).max(1000),
    reason: z.string().trim().max(240).optional(),
  }),
]);

export async function GET() {
  const access = await requireAdminPermission("PLATFORM_SETTINGS");
  if (access.response) return access.response;

  const keys = [
    ...PLATFORM_CONTROLS.map((item) => item.key),
    APP_DOWNLOAD_SETTING_KEY,
  ];
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true, updatedAt: true },
  });
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));

  const features = PLATFORM_CONTROLS.map((item) => {
    const setting = byKey.get(item.key);
    return {
      ...item,
      enabled: setting ? setting.value.trim().toLowerCase() === "true" : item.defaultEnabled,
      updatedAt: setting?.updatedAt ?? null,
      configured: Boolean(setting),
    };
  });

  const savedApk = byKey.get(APP_DOWNLOAD_SETTING_KEY)?.value?.trim();
  const apkUrl = savedApk && isDirectApkUrl(savedApk)
    ? savedApk
    : DEFAULT_ANDROID_APK_URL;

  return NextResponse.json({
    features,
    apk: {
      url: apkUrl,
      configured: Boolean(savedApk && isDirectApkUrl(savedApk)),
    },
    currentAdmin: { id: access.user.id, role: access.user.role },
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdminPermission("PLATFORM_SETTINGS");
  if (access.response) return access.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid application-control change." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.kind === "platform") {
    const definition = PLATFORM_CONTROLS.find((item) => item.key === data.key);
    if (!definition) {
      return NextResponse.json({ error: "Unknown platform control." }, { status: 400 });
    }

    const value = String(data.enabled);
    const reason = data.reason || `Application control: ${definition.label}`;
    const { setting, beforeValue } = await prisma.$transaction(async (tx) => {
      const before = await tx.systemSetting.findUnique({
        where: { key: definition.key },
        select: { value: true },
      });
      const setting = await tx.systemSetting.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          value,
          description: definition.description,
          updatedById: access.user.id,
        },
        update: {
          value,
          description: definition.description,
          updatedById: access.user.id,
        },
        select: { key: true, value: true, updatedAt: true },
      });

      await tx.adminSettingChange.create({
        data: {
          settingKey: definition.key,
          actorId: access.user.id,
          before: before?.value ?? null,
          after: value,
          reason,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId: access.user.id,
          action: "UPDATE_PLATFORM_CONTROL",
          targetType: "PLATFORM_SETTING",
          targetId: definition.key,
          details: JSON.stringify({ before: before?.value ?? null, after: value, reason }),
        },
      });
      return { setting, beforeValue: before?.value ?? null };
    });

    await recordAdminEvent({
      access,
      request,
      action: "UPDATE_PLATFORM_CONTROL",
      resource: "PLATFORM_SETTING",
      resourceId: definition.key,
      permission: "PLATFORM_SETTINGS",
      before: beforeValue ?? String(definition.defaultEnabled),
      after: value,
      reason,
      riskLevel: data.enabled ? "MEDIUM" : "HIGH",
    });

    return NextResponse.json({
      feature: {
        ...definition,
        enabled: data.enabled,
        updatedAt: setting.updatedAt,
        configured: true,
      },
    });
  }

  if (!isDirectApkUrl(data.value)) {
    return NextResponse.json({
      error: "Enter a direct HTTPS download URL whose path ends in .apk.",
    }, { status: 400 });
  }

  const reason = data.reason || "Updated Android APK download URL.";
  const { setting, beforeValue } = await prisma.$transaction(async (tx) => {
    const before = await tx.systemSetting.findUnique({
      where: { key: APP_DOWNLOAD_SETTING_KEY },
      select: { value: true },
    });
    const setting = await tx.systemSetting.upsert({
      where: { key: APP_DOWNLOAD_SETTING_KEY },
      create: {
        key: APP_DOWNLOAD_SETTING_KEY,
        value: data.value,
        description: "Direct Android APK download URL controlled by Socialhub administrators.",
        updatedById: access.user.id,
      },
      update: {
        value: data.value,
        description: "Direct Android APK download URL controlled by Socialhub administrators.",
        updatedById: access.user.id,
      },
      select: { key: true, value: true, updatedAt: true },
    });
    await tx.adminSettingChange.create({
      data: {
        settingKey: APP_DOWNLOAD_SETTING_KEY,
        actorId: access.user.id,
        before: before?.value ?? null,
        after: setting.value,
        reason,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: access.user.id,
        action: "UPDATE_ANDROID_APK_URL",
        targetType: "APPLICATION_RELEASE",
        targetId: APP_DOWNLOAD_SETTING_KEY,
        details: JSON.stringify({ before: before?.value ?? null, after: setting.value, reason }),
      },
    });
    return { setting, beforeValue: before?.value ?? null };
  });
  await recordAdminEvent({
    access,
    request,
    action: "UPDATE_ANDROID_APK_URL",
    resource: "APPLICATION_RELEASE",
    resourceId: APP_DOWNLOAD_SETTING_KEY,
    permission: "PLATFORM_SETTINGS",
    before: beforeValue,
    after: setting.value,
    reason,
    riskLevel: "MEDIUM",
  });

  return NextResponse.json({
    apk: { url: setting.value, configured: true, updatedAt: setting.updatedAt },
  });
}
