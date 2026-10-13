/**
 * Keep optimization limited to hosts explicitly configured in next.config.ts.
 * User-supplied images from other hosts and local preview/blob URLs remain
 * unoptimized so existing custom-avatar and upload flows keep working.
 */
export function canOptimizeSocialImage(value: string | null | undefined): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "public.blob.vercel-storage.com" ||
      hostname.endsWith(".public.blob.vercel-storage.com") ||
      hostname === "googleusercontent.com" ||
      hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}
