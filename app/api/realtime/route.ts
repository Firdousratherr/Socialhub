import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { readRealtimeEvents } from "@/lib/realtime";
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rl = await consumeRateLimit(rateLimitKey("realtime", request, session.user.id), 120, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  const takeValue = Number(params.get("take") ?? "50");
  const take = Number.isFinite(takeValue) ? takeValue : 50;

  const result = await readRealtimeEvents(session.user.id, cursor, take);
  return NextResponse.json({
    ...result,
    serverTime: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Socialhub-Realtime": "poll-v1",
    },
  });
}