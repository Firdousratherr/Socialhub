"use client";

import { fetchWithTimeout } from "@/lib/client-fetch";

type PreparedUpload = {
  uploadUrl: string;
  reservationId: string;
  pathname: string;
  mimeType: string;
  mediaType: "IMAGE" | "VIDEO";
};

export type MediaUploadResult = {
  url: string;
  pathname: string;
  mediaType: "IMAGE" | "VIDEO";
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : fallback;
    throw new Error(message);
  }
  return data as T;
}

/**
 * Upload the file directly to Blob with a short-lived, per-file signed URL.
 * The Vercel Function receives metadata only, so 4.5 MB function-body limits do
 * not block larger media uploads.
 */
export async function uploadMediaFile(file: File): Promise<MediaUploadResult> {
  if (!file.size || !file.type) {
    throw new Error("Choose a readable image or video file.");
  }

  let reservationId: string | null = null;
  try {
    const prepareResponse = await fetchWithTimeout(
      "/api/uploads/client",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "prepare",
          size: file.size,
          mimeType: file.type,
        }),
      },
      30_000,
    );
    const prepared = await readJson<PreparedUpload>(prepareResponse, "Could not prepare media upload.");
    reservationId = prepared.reservationId;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const uploadResponse = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": prepared.mimeType },
        body: file,
        signal: controller.signal,
      });
      if (!uploadResponse.ok) {
        throw new Error("Storage rejected the upload. Please retry.");
      }
    } finally {
      window.clearTimeout(timeoutId);
    }

    const finalizeResponse = await fetchWithTimeout(
      "/api/uploads/client",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "finalize", reservationId }),
      },
      30_000,
    );
    return await readJson<MediaUploadResult>(finalizeResponse, "Could not finish the upload.");
  } catch (error) {
    if (reservationId) {
      await fetchWithTimeout(
        "/api/uploads/client",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "cancel", reservationId }),
        },
        10_000,
      ).catch(() => undefined);
    }
    throw error instanceof Error ? error : new Error("Could not upload the file.");
  }
}
