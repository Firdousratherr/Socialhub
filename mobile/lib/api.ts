import { File as ExpoFile } from "expo-file-system";
import { authClient } from "./auth-client";

const API_REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; data: unknown }> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let data: unknown = {};
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
    }
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

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

  const { response, data } = await fetchJsonWithTimeout(
    `${API_BASE_URL}${path}`,
    { ...init, headers, credentials: "omit" },
    API_REQUEST_TIMEOUT_MS,
  );
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
  _fileName: string,
): Promise<UploadResult> {
  const file = new ExpoFile(uri);
  const size = file.size;
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("The selected media file could not be read.");
  }

  let reservationId: string | null = null;
  try {
    const prepared = await apiFetch<{
      uploadUrl: string;
      reservationId: string;
      pathname: string;
      mimeType: string;
      mediaType: "IMAGE" | "VIDEO";
    }>("/api/uploads/client", {
      method: "POST",
      body: JSON.stringify({ operation: "prepare", size, mimeType }),
    });
    reservationId = prepared.reservationId;

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), UPLOAD_REQUEST_TIMEOUT_MS);
    let uploadResponse: Awaited<ReturnType<typeof file.upload>>;
    try {
      uploadResponse = await file.upload(prepared.uploadUrl, {
        httpMethod: "PUT",
        headers: { "Content-Type": prepared.mimeType },
        mimeType: prepared.mimeType,
        signal: uploadController.signal,
      });
    } catch (uploadError) {
      if (uploadController.signal.aborted) {
        throw new Error("The upload timed out. Check your connection and try again.");
      }
      throw uploadError;
    } finally {
      clearTimeout(uploadTimeout);
    }
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error("Storage rejected the upload. Please retry.");
    }

    return await apiFetch<UploadResult>("/api/uploads/client", {
      method: "POST",
      body: JSON.stringify({ operation: "finalize", reservationId }),
    });
  } catch (error) {
    if (reservationId) {
      await apiFetch("/api/uploads/client", {
        method: "POST",
        body: JSON.stringify({ operation: "cancel", reservationId }),
      }).catch(() => undefined);
    }
    throw error instanceof Error ? error : new Error("Could not upload the file.");
  }
}
