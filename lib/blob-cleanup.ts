import { del } from "@vercel/blob";

function isManagedBlob(value: string | null | undefined) {
  if (!value) return false;
  try {
    return new URL(value).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function safeDeleteBlob(value: string | null | undefined) {
  if (!isManagedBlob(value)) return;
  try {
    await del(value);
  } catch (error) {
    console.error("Socialhub blob cleanup failed", error);
  }
}
