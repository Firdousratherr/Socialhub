export const DEFAULT_ANDROID_APK_URL =
  "https://github.com/Firdousratherr/Socialhub/releases/download/v1.0.6/app-release.apk";

export const APP_DOWNLOAD_SETTING_KEY = "app.download.url";

export async function getAndroidApkUrl(getSetting: (key: string) => Promise<string | null>) {
  const configured = (await getSetting(APP_DOWNLOAD_SETTING_KEY))?.trim();
  return configured || DEFAULT_ANDROID_APK_URL;
}
