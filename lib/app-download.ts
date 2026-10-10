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

export async function getAndroidApkUrl(
  getSetting: (key: string) => Promise<string | null>,
): Promise<string> {
  const configured = (await getSetting(APP_DOWNLOAD_SETTING_KEY))?.trim();
  return configured && isDirectApkUrl(configured)
    ? configured
    : DEFAULT_ANDROID_APK_URL;
}
