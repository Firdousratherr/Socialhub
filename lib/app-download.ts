export const DEFAULT_ANDROID_APK_URL =
  "https://github.com/Firdousratherr/Socialhub/releases/download/v1.0.9/app-release.apk";

export const APP_DOWNLOAD_SETTING_KEY = "app.download.url";

/** Only allow secure direct-file URLs configured by the admin. */
export function isDirectApkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /\.apk$/i.test(decodeURIComponent(url.pathname))
    );
  } catch {
    return false;
  }
}

/**
 * The official Socialhub release URL is versioned. If an older official release
 * URL was persisted in system settings, follow the latest release default
 * instead of leaving the public download page stuck on an obsolete APK.
 * Custom APK hosts remain administrator-controlled.
 */
export function isOfficialSocialhubReleaseApkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.toLowerCase().startsWith("/firdousratherr/socialhub/releases/download/") &&
      /^\/firdousratherr\/socialhub\/releases\/download\/v\d+\.\d+\.\d+\/app-release\.apk$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export async function getAndroidApkUrl(
  getSetting: (key: string) => Promise<string | null>,
): Promise<string> {
  const configured = (await getSetting(APP_DOWNLOAD_SETTING_KEY))?.trim();
  if (!configured || !isDirectApkUrl(configured)) return DEFAULT_ANDROID_APK_URL;
  if (isOfficialSocialhubReleaseApkUrl(configured)) return DEFAULT_ANDROID_APK_URL;
  return configured;
}
