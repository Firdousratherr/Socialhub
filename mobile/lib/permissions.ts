import { Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

export type PermissionState = "granted" | "denied" | "blocked" | "unknown";

function state(response: { granted: boolean; canAskAgain: boolean }): PermissionState {
  if (response.granted) return "granted";
  if (!response.canAskAgain) return "blocked";
  return "denied";
}

export async function getMediaPermission() {
  return ImagePicker.getMediaLibraryPermissionsAsync();
}

export async function requestMediaPermission() {
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}

export async function requestCameraPermission() {
  return ImagePicker.requestCameraPermissionsAsync();
}

export async function getCameraPermission() {
  return ImagePicker.getCameraPermissionsAsync();
}

export async function requestMicrophonePermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  if (Platform.OS !== "android") return { granted: false, canAskAgain: false };
  const PermissionsAndroid = await import("react-native").then((m) => m.PermissionsAndroid);
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: "Microphone access",
    message: "Socialhub needs your microphone only when you record audio or join a voice/video call.",
    buttonPositive: "Allow",
    buttonNegative: "Not now",
  });
  return { granted: result === PermissionsAndroid.RESULTS.GRANTED, canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN };
}

export async function getMicrophonePermission(): Promise<PermissionState> {
  if (Platform.OS !== "android") return "unknown";
  const PermissionsAndroid = await import("react-native").then((m) => m.PermissionsAndroid);
  const result = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result ? "granted" : "denied";
}

export async function requestNotificationPermission() {
  if (Platform.OS !== "android") return null;
  await Notifications.setNotificationChannelAsync("socialhub-default", {
    name: "Socialhub",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  return Notifications.requestPermissionsAsync();
}

export async function getNotificationPermission() {
  if (Platform.OS !== "android") return null;
  return Notifications.getPermissionsAsync();
}

export async function openAndroidSettings() {
  return Linking.openSettings();
}

export { state as permissionState };
