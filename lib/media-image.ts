/** Return true only for first-party Vercel Blob URLs we explicitly allow in next.config.ts. */
export function isVercelBlobUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
