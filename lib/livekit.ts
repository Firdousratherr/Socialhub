import { AccessToken } from "livekit-server-sdk";

export function liveKitConfigured() {
  return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

export async function createCallToken(input: { identity: string; name: string; roomName: string; isVideo: boolean }) {
  if (!liveKitConfigured()) throw new Error("LiveKit is not configured.");
  const token = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: input.identity,
    name: input.name,
    ttl: "10m",
  });
  token.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}
