import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";

export function configurePushNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("default", {
      name: "Socialhub",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 200, 250],
      sound: "default",
    }).catch(() => {});
  }
}

export function subscribeToNotificationOpen(onUrl: (url: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const url = typeof data?.url === "string" ? data.url : typeof data?.deepLink === "string" ? data.deepLink : "";
    if (url) onUrl(url);
  });
}

export async function registerPushDevice() {
  if (Platform.OS !== "android") return { granted: false, registered: false };

  const permissions = await Notifications.getPermissionsAsync();
  let granted = permissions.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }

  if (!granted) return { granted: false, registered: false };

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = String(deviceToken.data ?? "").trim();
  if (!token) return { granted: true, registered: false };

  await apiFetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({
      token,
      platform: "ANDROID",
      provider: "FCM",
      appVersion: "1.0.3",
      deviceName: "Android device",
    }),
  });

  return { granted: true, registered: true, token };
}

export async function unregisterPushDevice(token?: string) {
  try {
    let deviceToken = token?.trim() ?? "";
    if (!deviceToken && Platform.OS === "android") {
      const native = await Notifications.getDevicePushTokenAsync();
      deviceToken = String(native.data ?? "").trim();
    }
    if (!deviceToken) return;
    await apiFetch("/api/push/register", {
      method: "DELETE",
      body: JSON.stringify({ token: deviceToken }),
    });
  } catch {
    // Best-effort cleanup during sign-out.
  }
}