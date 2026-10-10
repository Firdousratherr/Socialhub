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
import {
  DEFAULT_UPLOAD_LIMITS,
  getDailyUploadFallback,
  parseUploadLimits,
  UPLOAD_LIMIT_BOUNDS,
  UPLOAD_LIMIT_SETTING_KEYS,
} from "@/lib/upload-limits";

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
    description: "Allow access to direct-message conversations, message sending, typing indicators and audio/video calls.",
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
  z.object({
    kind: z.literal("upload-limits"),
    maxImageBytes: z.number().int().min(UPLOAD_LIMIT_BOUNDS.maxImageBytes.min).max(UPLOAD_LIMIT_BOUNDS.maxImageBytes.max),
    maxVideoBytes: z.number().int().min(UPLOAD_LIMIT_BOUNDS.maxVideoBytes.min).max(UPLOAD_LIMIT_BOUNDS.maxVideoBytes.max),
    maxDailyBytes: z.number().int().min(UPLOAD_LIMIT_BOUNDS.maxDailyBytes.min).max(UPLOAD_LIMIT_BOUNDS.maxDailyBytes.max),
    reason: z.string().trim().max(240).optional(),
  }),
]);

export async function GET() {
  const access = await requireAdminPermission("PLATFORM_SETTINGS");
  if (access.response) return access.response;

  const keys = [
    ...PLATFORM_CONTROLS.map((item) => item.key),
    APP_DOWNLOAD_SETTING_KEY,
    ...Object.values(UPLOAD_LIMIT_SETTING_KEYS),
  ];
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true, updatedAt: true },
  });
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const uploadSettingValues = Object.fromEntries(
    Object.values(UPLOAD_LIMIT_SETTING_KEYS).map((key) => [key, byKey.get(key)?.value]),
  );
  const uploadLimits = parseUploadLimits(
    uploadSettingValues,
    getDailyUploadFallback(process.env.MAX_DAILY_UPLOAD_BYTES),
  );
  const configuredUploadLimits = {
    maxImageBytes: Boolean(byKey.get(UPLOAD_LIMIT_SETTING_KEYS.maxImageBytes)),
    maxVideoBytes: Boolean(byKey.get(UPLOAD_LIMIT_SETTING_KEYS.maxVideoBytes)),
    maxDailyBytes: Boolean(byKey.get(UPLOAD_LIMIT_SETTING_KEYS.maxDailyBytes)),
  };

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
    uploadLimits: {
      ...uploadLimits,
      configured: configuredUploadLimits,
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

  if (data.kind === "upload-limits") {
    const entries = [
      {
        key: UPLOAD_LIMIT_SETTING_KEYS.maxImageBytes,
        value: String(data.maxImageBytes),
        description: "Maximum accepted image upload size in bytes (hard-capped at 4 MiB).",
      },
      {
        key: UPLOAD_LIMIT_SETTING_KEYS.maxVideoBytes,
        value: String(data.maxVideoBytes),
        description: "Maximum accepted video upload size in bytes (hard-capped at 20 MiB).",
      },
      {
        key: UPLOAD_LIMIT_SETTING_KEYS.maxDailyBytes,
        value: String(data.maxDailyBytes),
        description: "Maximum daily upload quota per user in bytes.",
      },
    ];
    const beforeSettings = await prisma.systemSetting.findMany({
      where: { key: { in: entries.map((entry) => entry.key) } },
      select: { key: true, value: true },
    });
    const beforeMap = new Map(beforeSettings.map((setting) => [setting.key, setting.value]));
    const before = {
      maxImageBytes: Number(beforeMap.get(UPLOAD_LIMIT_SETTING_KEYS.maxImageBytes) ?? DEFAULT_UPLOAD_LIMITS.maxImageBytes),
      maxVideoBytes: Number(beforeMap.get(UPLOAD_LIMIT_SETTING_KEYS.maxVideoBytes) ?? DEFAULT_UPLOAD_LIMITS.maxVideoBytes),
      maxDailyBytes: Number(beforeMap.get(UPLOAD_LIMIT_SETTING_KEYS.maxDailyBytes) ?? getDailyUploadFallback(process.env.MAX_DAILY_UPLOAD_BYTES)),
    };
    const after = {
      maxImageBytes: data.maxImageBytes,
      maxVideoBytes: data.maxVideoBytes,
      maxDailyBytes: data.maxDailyBytes,
    };
    const reason = data.reason || "Updated upload size limits.";

    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const previousValue = beforeMap.get(entry.key) ?? null;
        await tx.systemSetting.upsert({
          where: { key: entry.key },
          create: {
            key: entry.key,
            value: entry.value,
            description: entry.description,
            updatedById: access.user.id,
          },
          update: {
            value: entry.value,
            description: entry.description,
            updatedById: access.user.id,
          },
        });
        await tx.adminSettingChange.create({
          data: {
            settingKey: entry.key,
            actorId: access.user.id,
            before: previousValue,
            after: entry.value,
            reason,
          },
        });
        await tx.adminAuditLog.create({
          data: {
            adminId: access.user.id,
            action: "UPDATE_UPLOAD_LIMIT",
            targetType: "PLATFORM_SETTING",
            targetId: entry.key,
            details: JSON.stringify({ before: previousValue, after: entry.value, reason }),
          },
        });
      }
    });

    await recordAdminEvent({
      access,
      request,
      action: "UPDATE_UPLOAD_LIMITS",
      resource: "UPLOAD_LIMITS",
      resourceId: "uploads",
      permission: "PLATFORM_SETTINGS",
      before,
      after,
      reason,
      riskLevel: "HIGH",
    });

    return NextResponse.json({
      uploadLimits: {
        ...after,
        configured: {
          maxImageBytes: true,
          maxVideoBytes: true,
          maxDailyBytes: true,
        },
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
