export type PostSyncEvent =
  | { type: "created"; postId: string }
  | { type: "updated"; postId: string }
  | { type: "deleted"; postId: string }
  | { type: "visibility-changed"; postId: string }
  | { type: "pinned"; postId: string; pinned: boolean };

const CHANNEL_NAME = "socialhub-post-sync";

type PostSyncListener = (event: PostSyncEvent) => void;
type WireEvent = PostSyncEvent & { sourceId: string };
const CLIENT_ID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : "client-" + Date.now() + "-" + Math.random().toString(36).slice(2);

export function emitPostSyncEvent(event: PostSyncEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PostSyncEvent>(CHANNEL_NAME, { detail: { ...event, sourceId: CLIENT_ID } as PostSyncEvent }));
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ ...event, sourceId: CLIENT_ID } as WireEvent);
    channel.close();
  } catch {
    // BroadcastChannel is unavailable in some browsers/webviews.
  }
}

export function subscribePostSync(listener: PostSyncListener) {
  if (typeof window === "undefined") return () => undefined;

  const onWindowEvent = (event: Event) => {
    const detail = (event as CustomEvent<PostSyncEvent>).detail;
    if (detail) listener(detail);
  };

  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent<WireEvent>) => {
    if (event.data && event.data.sourceId !== CLIENT_ID) listener(event.data);
  };

  window.addEventListener(CHANNEL_NAME, onWindowEvent);
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", onChannelMessage);
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener(CHANNEL_NAME, onWindowEvent);
    channel?.removeEventListener("message", onChannelMessage);
    channel?.close();
  };
}
