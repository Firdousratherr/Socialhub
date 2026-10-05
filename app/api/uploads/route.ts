import { put } from "@vercel/blob";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeDeleteBlob } from "@/lib/blob-cleanup";
import { platformEnabled } from "@/lib/platform-controls";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DAILY_UPLOAD_BYTES = Number(process.env.MAX_DAILY_UPLOAD_BYTES ?? 25 * 1024 * 1024);
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function matches(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function matchesAscii(bytes: Uint8Array, text: string, offset = 0) {
  return text.split("").every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && matches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 8 && matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytes.length >= 6 && (matchesAscii(bytes, "GIF87a") || matchesAscii(bytes, "GIF89a"))) return "image/gif";
  if (bytes.length >= 12 && matchesAscii(bytes, "RIFF", 0) && matchesAscii(bytes, "WEBP", 8)) return "image/webp";
  return null;
}

function extensionFor(type: string) {
  return type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rl = await consumeRateLimit(rateLimitKey("upload", request, session.user.id), 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const uploadsEnabled = await platformEnabled("uploads", true);
  if (!uploadsEnabled) return NextResponse.json({ error: "Uploads are temporarily disabled by the platform administrator." }, { status: 503 });
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP, and GIF images are supported." }, { status: 415 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 4 MB or smaller." }, { status: 413 });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const usage = await prisma.uploadUsage.aggregate({
    where: { userId: session.user.id, createdAt: { gte: dayStart } },
    _sum: { bytes: true },
  });
  const usedBytes = usage._sum.bytes ?? 0;
  if (usedBytes + file.size > MAX_DAILY_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Your daily upload limit has been reached. Try again tomorrow." }, { status: 429 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType || detectedType !== file.type) {
    return NextResponse.json({ error: "The file contents do not match the declared image type." }, { status: 415 });
  }

  const path = `uploads/${session.user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  try {
    await prisma.uploadUsage.create({
      data: { userId: session.user.id, bytes: file.size, url: blob.url, pathname: blob.pathname, mimeType: file.type },
    });
  } catch (trackingError) {
    await safeDeleteBlob(blob.url);
    console.error("Could not record upload usage; the uploaded blob was removed.", trackingError);
    return NextResponse.json({ error: "Could not finish recording the upload. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ url: blob.url, pathname: blob.pathname }, { status: 201 });
}
