import { authClient } from "./auth-client";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://socialhublive.vercel.app";

const NATIVE_CLIENT_HEADER = "X-Socialhub-Client";
const NATIVE_CLIENT_VALUE = "android";

function errorMessage(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

function addNativeHeaders(headers: Headers) {
  headers.set(NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cookie = await authClient.getCookie();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  addNativeHeaders(headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "omit",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(data, `Request failed (${response.status})`));
  }
  return data as T;
}

export type UploadResult = {
  url: string;
  pathname: string;
  mediaType: "IMAGE" | "VIDEO";
};

export async function uploadMedia(
  uri: string,
  mimeType: string,
  fileName: string,
): Promise<UploadResult> {
  const cookie = await authClient.getCookie();
  const formData = new FormData();
  formData.append(
    "file",
    {
      uri,
      type: mimeType,
      name: fileName,
    } as unknown as Blob,
  );

  const headers = new Headers({ Accept: "application/json" });
  addNativeHeaders(headers);
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "omit",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(data, `Upload failed (${response.status})`));
  }
  return data as UploadResult;
}
