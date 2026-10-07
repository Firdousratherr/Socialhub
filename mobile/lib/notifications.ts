import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";

export async function registerDevicePushToken() {
  if (Platform.OS !== "android") return null;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;
  const token = await Notifications.getDevicePushTokenAsync();
  const value = typeof token.data === "string" ? token.data : JSON.stringify(token.data);
  await apiFetch("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({ token: value, platform: "android" }),
  });
  return value;
}
