import { put } from "@vercel/blob";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"]);

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

function detectVideoType(bytes: Uint8Array) {
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video/mp4";
  if (bytes.length >= 4 && matches(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a supported image or video file." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP, GIF, MP4, and WebM files are supported." }, { status: 415 });
  }

  const isVideo = file.type.startsWith("video/");
  if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: isVideo ? "Video must be 20 MB or smaller." : "Image must be 4 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = isVideo ? detectVideoType(bytes) : detectImageType(bytes);
  if (!detectedType || detectedType !== file.type) {
    return NextResponse.json({ error: "The file contents do not match the declared image type." }, { status: 415 });
  }

  const path = `uploads/${session.user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url, pathname: blob.pathname }, { status: 201 });
}
