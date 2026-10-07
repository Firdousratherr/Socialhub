import * as ImagePicker from "expo-image-picker";
import * as Camera from "expo-camera";
import * as Audio from "expo-audio";
import * as Notifications from "expo-notifications";

export type DevicePermissionState = {
  photos: boolean;
  camera: boolean;
  microphone: boolean;
  notifications: boolean;
};

export async function getDevicePermissionState(): Promise<DevicePermissionState> {
  const [photos, camera, microphone, notifications] = await Promise.all([
    ImagePicker.getMediaLibraryPermissionsAsync(),
    Camera.getCameraPermissionsAsync(),
    Audio.getRecordingPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  return {
    photos: photos.granted,
    camera: camera.granted,
    microphone: microphone.granted,
    notifications: notifications.granted,
  };
}

export async function requestDevicePermission(kind: keyof DevicePermissionState) {
  switch (kind) {
    case "photos":
      return ImagePicker.requestMediaLibraryPermissionsAsync();
    case "camera":
      return Camera.requestCameraPermissionsAsync();
    case "microphone":
      return Audio.requestRecordingPermissionsAsync();
    case "notifications":
      return Notifications.requestPermissionsAsync();
  }
}
