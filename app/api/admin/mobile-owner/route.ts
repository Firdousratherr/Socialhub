import { NextResponse } from "next/server";
import { requireAdminOnly } from "@/app/api/admin/_auth";

export async function GET() {
  const access = await requireAdminOnly();
  if (access.response) return access.response;
  if (!access.user.isOwner) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  }
  return NextResponse.json({ allowed: true });
}
