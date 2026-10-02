import { prisma } from "@/lib/prisma";

export async function getSystemSetting(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
  return setting?.value ?? null;
}

export async function isFeatureEnabled(key: string, defaultValue = false) {
  const flag = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
  return flag?.enabled ?? defaultValue;
}

export async function getBooleanSetting(key: string, defaultValue: boolean) {
  const value = await getSystemSetting(key);
  if (value === null) return defaultValue;
  return value.trim().toLowerCase() === "true";
}
