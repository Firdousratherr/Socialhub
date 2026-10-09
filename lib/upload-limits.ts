export type UploadLimits = {
  maxImageBytes: number;
  maxVideoBytes: number;
  maxDailyBytes: number;
};

export const UPLOAD_LIMIT_SETTING_KEYS = {
  maxImageBytes: "uploads.maxImageBytes",
  maxVideoBytes: "uploads.maxVideoBytes",
  maxDailyBytes: "uploads.maxDailyBytes",
} as const;

const MiB = 1024 * 1024;

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxImageBytes: 4 * MiB,
  maxVideoBytes: 20 * MiB,
  maxDailyBytes: 25 * MiB,
};

export const UPLOAD_LIMIT_BOUNDS = {
  maxImageBytes: { min: 512 * 1024, max: 4 * MiB },
  maxVideoBytes: { min: 1 * MiB, max: 20 * MiB },
  maxDailyBytes: { min: 1 * MiB, max: 500 * MiB },
} as const;

function parseBytes(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function getDailyUploadFallback(value: string | undefined): number {
  return parseBytes(
    value,
    DEFAULT_UPLOAD_LIMITS.maxDailyBytes,
    UPLOAD_LIMIT_BOUNDS.maxDailyBytes.min,
    UPLOAD_LIMIT_BOUNDS.maxDailyBytes.max,
  );
}

export function parseUploadLimits(
  values: Partial<Record<string, string | undefined>>,
  dailyFallback = DEFAULT_UPLOAD_LIMITS.maxDailyBytes,
): UploadLimits {
  return {
    maxImageBytes: parseBytes(
      values[UPLOAD_LIMIT_SETTING_KEYS.maxImageBytes],
      DEFAULT_UPLOAD_LIMITS.maxImageBytes,
      UPLOAD_LIMIT_BOUNDS.maxImageBytes.min,
      UPLOAD_LIMIT_BOUNDS.maxImageBytes.max,
    ),
    maxVideoBytes: parseBytes(
      values[UPLOAD_LIMIT_SETTING_KEYS.maxVideoBytes],
      DEFAULT_UPLOAD_LIMITS.maxVideoBytes,
      UPLOAD_LIMIT_BOUNDS.maxVideoBytes.min,
      UPLOAD_LIMIT_BOUNDS.maxVideoBytes.max,
    ),
    maxDailyBytes: parseBytes(
      values[UPLOAD_LIMIT_SETTING_KEYS.maxDailyBytes],
      dailyFallback,
      UPLOAD_LIMIT_BOUNDS.maxDailyBytes.min,
      UPLOAD_LIMIT_BOUNDS.maxDailyBytes.max,
    ),
  };
}
