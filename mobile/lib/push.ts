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
      appVersion: "1.0.2",
      deviceName: "Android device",
    }),
  });

  return { granted: true, registered: true };
}

export async function unregisterPushDevice(token?: string) {
  try {
    await apiFetch("/api/push/register", {
      method: "DELETE",
      body: JSON.stringify(token ? { token } : { }),
    });
  } catch {
    // Best-effort cleanup during sign-out.
  }
}
