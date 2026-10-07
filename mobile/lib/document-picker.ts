import * as DocumentPicker from "expo-document-picker";
import { uploadFile } from "./api";

export async function pickAndUploadDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
    ],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return uploadFile(asset.uri, asset.mimeType ?? "application/octet-stream", asset.name);
}
