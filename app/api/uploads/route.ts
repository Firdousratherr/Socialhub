import { put } from "@vercel/blob";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP, and GIF images are supported." }, { status: 415 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 4 MB or smaller." }, { status: 413 });
  }

  const path = `uploads/${session.user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url, pathname: blob.pathname }, { status: 201 });
}
