import { issueSignedToken, list, presignUrl } from "@vercel/blob";
import { NextResponse } from "next/server";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { platformEnabled } from "@/lib/platform-controls";
import { safeDeleteBlob } from "@/lib/blob-cleanup";
import {
  getDailyUploadFallback,
  parseUploadLimits,
  UPLOAD_LIMIT_SETTING_KEYS,
} from "@/lib/upload-limits";

const MiB = 1024 * 1024;
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

const requestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("prepare"),
    size: z.number().int().positive().max(20 * MiB),
    mimeType: z.string().min(1).max(100),
  }),
  z.object({
    operation: z.literal("finalize"),
    reservationId: z.string().min(1).max(100),
  }),
  z.object({
    operation: z.literal("cancel"),
    reservationId: z.string().min(1).max(100),
  }),
]);

type AllowedMimeType = keyof typeof MIME_TO_EXTENSION;

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return Object.hasOwn(MIME_TO_EXTENSION, value);
}

function signatureMatches(bytes: Uint8Array, type: AllowedMimeType) {
  const matches = (signature: number[], offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);
  const ascii = (value: string, offset = 0) =>
    value.split("").every((char, index) => bytes[offset + index] === char.charCodeAt(0));

  switch (type) {
    case "image/jpeg":
      return bytes.length >= 3 && matches([0xff, 0xd8, 0xff]);
    case "image/png":
      return bytes.length >= 8 && matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return bytes.length >= 6 && (ascii("GIF87a") || ascii("GIF89a"));
    case "image/webp":
      return bytes.length >= 12 && ascii("RIFF") && ascii("WEBP", 8);
    case "video/mp4":
      return bytes.length >= 12 && ascii("ftyp", 4);
    case "video/webm":
      return bytes.length >= 4 && matches([0x1a, 0x45, 0xdf, 0xa3]);
  }
}

async function blobSignatureMatches(url: string, type: AllowedMimeType) {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-15" },
    cache: "no-store",
  });
  if (!response.ok || !response.body) return false;

  const reader = response.body.getReader();
  const buffer = new Uint8Array(16);
  let length = 0;
  try {
    while (length < buffer.length) {
      const part = await reader.read();
      if (part.done) break;
      const count = Math.min(part.value.length, buffer.length - length);
      buffer.set(part.value.subarray(0, count), length);
      length += count;
      if (count < part.value.length) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return signatureMatches(buffer.subarray(0, length), type);
}

async function getCurrentUploadLimits() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(UPLOAD_LIMIT_SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  return parseUploadLimits(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
    getDailyUploadFallback(process.env.MAX_DAILY_UPLOAD_BYTES),
  );
}

async function reserveUpload(userId: string, size: number, mimeType: string) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return prisma.$transaction(async (tx) => {
    // Serialize reservations for the same user so simultaneous uploads cannot
    // all pass the daily quota check using the same stale aggregate.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

    await tx.uploadUsage.deleteMany({
      where: {
        userId,
        url: null,
        createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
    });

    const usage = await tx.uploadUsage.aggregate({
      where: { userId, createdAt: { gte: dayStart } },
      _sum: { bytes: true },
    });
    if ((usage._sum.bytes ?? 0) + size > (await getCurrentUploadLimits()).maxDailyBytes) {
      return null;
    }

    const id = crypto.randomUUID();
    const extension = MIME_TO_EXTENSION[mimeType];
    const pathname = `uploads/${userId}/${id}.${extension}`;
    return tx.uploadUsage.create({
      data: { id, userId, bytes: size, mimeType, pathname },
      select: { id: true, userId: true, bytes: true, mimeType: true, pathname: true },
    });
  });
}

export async function POST(request: Request) {
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const operation = input.data.operation;
  const rateLimit = await consumeRateLimit(
    rateLimitKey("upload", request, session.user.id),
    operation === "finalize" ? 40 : 20,
    60,
  );
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  if (operation === "prepare") {
    const { size, mimeType } = input.data;
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json({ error: "Only JPG, PNG, WebP, GIF, MP4 and WebM files are supported." }, { status: 415 });
    }
    if (!(await platformEnabled("uploads", true))) {
      return NextResponse.json({ error: "Uploads are temporarily disabled by the platform administrator." }, { status: 503 });
    }

    const limits = await getCurrentUploadLimits();
    const maxBytes = IMAGE_TYPES.has(mimeType) ? limits.maxImageBytes : limits.maxVideoBytes;
    if (size > maxBytes) {
      return NextResponse.json({
        error: `${VIDEO_TYPES.has(mimeType) ? "Video" : "Image"} must be ${(maxBytes / MiB).toFixed(maxBytes % MiB ? 1 : 0)} MB or smaller.`,
      }, { status: 413 });
    }

    const reservation = await reserveUpload(session.user.id, size, mimeType);
    if (!reservation) {
      return NextResponse.json({ error: "Your daily upload limit has been reached. Try again tomorrow." }, { status: 429 });
    }

    try {
      const validUntil = Date.now() + 15 * 60 * 1000;
      const signedToken = await issueSignedToken({
        pathname: reservation.pathname!,
        operations: ["put"],
        allowedContentTypes: [mimeType],
        maximumSizeInBytes: size,
        validUntil,
      });
      const { presignedUrl } = await presignUrl(signedToken, {
        operation: "put",
        pathname: reservation.pathname!,
        access: "public",
        allowedContentTypes: [mimeType],
        maximumSizeInBytes: size,
        addRandomSuffix: false,
        validUntil,
      });

      return NextResponse.json({
        uploadUrl: presignedUrl,
        reservationId: reservation.id,
        pathname: reservation.pathname,
        mimeType,
        mediaType: IMAGE_TYPES.has(mimeType) ? "IMAGE" : "VIDEO",
      });
    } catch (error) {
      await prisma.uploadUsage.deleteMany({ where: { id: reservation.id, userId: session.user.id } }).catch(() => undefined);
      console.error("Could not prepare direct upload.", error);
      return NextResponse.json({ error: "Could not prepare secure upload. Please retry." }, { status: 503 });
    }
  }

  const { reservationId } = input.data;
  const reservation = await prisma.uploadUsage.findUnique({ where: { id: reservationId } });
  if (!reservation || reservation.userId !== session.user.id || !reservation.pathname) {
    return NextResponse.json({ error: "Upload reservation not found." }, { status: 404 });
  }

  if (operation === "cancel") {
    if (reservation.url) {
      return NextResponse.json({ error: "This upload is already complete." }, { status: 409 });
    }
    const existing = await list({ prefix: reservation.pathname }).catch(() => ({ blobs: [] }));
    const matchingBlob = existing.blobs.find((blob) => blob.pathname === reservation.pathname);
    if (matchingBlob) await safeDeleteBlob(matchingBlob.url).catch(() => undefined);
    await prisma.uploadUsage.deleteMany({
      where: { id: reservation.id, userId: session.user.id, url: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (reservation.url) {
    return NextResponse.json({
      url: reservation.url,
      pathname: reservation.pathname,
      mediaType: reservation.mimeType && VIDEO_TYPES.has(reservation.mimeType) ? "VIDEO" : "IMAGE",
    });
  }

  const stored = await list({ prefix: reservation.pathname }).catch(() => ({ blobs: [] }));
  const blob = stored.blobs.find((item) => item.pathname === reservation.pathname);
  if (!blob) {
    return NextResponse.json({ error: "The upload has not reached storage yet. Retry finalization." }, { status: 409 });
  }

  const type = reservation.mimeType;
  if (
    !type ||
    !isAllowedMimeType(type) ||
    blob.contentType !== type ||
    !Number.isSafeInteger(blob.size) ||
    blob.size <= 0 ||
    blob.size > reservation.bytes
  ) {
    await safeDeleteBlob(blob.url).catch(() => undefined);
    await prisma.uploadUsage.deleteMany({ where: { id: reservation.id, userId: session.user.id, url: null } }).catch(() => undefined);
    return NextResponse.json({ error: "The uploaded file does not match its reservation." }, { status: 415 });
  }

  const limits = await getCurrentUploadLimits();
  const currentMaximum = IMAGE_TYPES.has(type) ? limits.maxImageBytes : limits.maxVideoBytes;
  if (blob.size > currentMaximum || !(await blobSignatureMatches(blob.url, type))) {
    await safeDeleteBlob(blob.url).catch(() => undefined);
    await prisma.uploadUsage.deleteMany({ where: { id: reservation.id, userId: session.user.id, url: null } }).catch(() => undefined);
    return NextResponse.json({ error: "The file contents do not match a supported media type or exceed the current upload limit." }, { status: 415 });
  }

  const mediaType = VIDEO_TYPES.has(type) ? "VIDEO" : "IMAGE";
  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.uploadUsage.findUnique({ where: { id: reservation.id } });
    if (!current || current.userId !== session.user.id) return "missing" as const;
    if (current.url) return current.url === blob.url ? "complete" as const : "conflict" as const;

    const changed = await tx.uploadUsage.updateMany({
      where: { id: reservation.id, userId: session.user.id, url: null },
      data: { url: blob.url, pathname: blob.pathname, mimeType: type, bytes: blob.size },
    });
    if (changed.count !== 1) return "retry" as const;

    await tx.mediaAsset.create({
      data: {
        userId: session.user.id,
        url: blob.url,
        mediaType,
        mimeType: type,
        byteSize: blob.size,
        status: "READY",
      },
    });
    return "complete" as const;
  });

  if (outcome !== "complete") {
    const latest = await prisma.uploadUsage.findUnique({ where: { id: reservation.id } });
    if (latest?.url === blob.url) {
      return NextResponse.json({ url: blob.url, pathname: blob.pathname, mediaType });
    }
    return NextResponse.json({ error: "Could not finalize the upload. Please retry." }, { status: 409 });
  }

  return NextResponse.json({ url: blob.url, pathname: blob.pathname, mediaType }, { status: 201 });
}
