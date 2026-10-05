export type LiveSyncEvent =
  | { type: "post-created"; postId: string }
  | { type: "post-updated"; postId: string }
  | { type: "post-deleted"; postId: string }
  | { type: "comment-created"; postId: string; commentId: string }
  | { type: "comment-updated"; postId: string; commentId: string }
  | { type: "comment-deleted"; postId: string; commentId: string }
  | { type: "story-updated"; storyId: string };

const CHANNEL_NAME = "socialhub-live-sync";
const CLIENT_ID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : "client-" + Date.now() + "-" + Math.random().toString(36).slice(2);

type WireEvent = LiveSyncEvent & { sourceId: string };
type LiveSyncListener = (event: LiveSyncEvent) => void;

export function emitLiveSync(event: LiveSyncEvent) {
  if (typeof window === "undefined") return;
  const wireEvent: WireEvent = { ...event, sourceId: CLIENT_ID };
  window.dispatchEvent(new CustomEvent<LiveSyncEvent>(CHANNEL_NAME, { detail: wireEvent }));
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(wireEvent);
    channel.close();
  } catch {
    // BroadcastChannel is unavailable in some browsers/webviews.
  }
}

export function subscribeLiveSync(listener: LiveSyncListener) {
  if (typeof window === "undefined") return () => undefined;
  const onWindowEvent = (event: Event) => {
    const detail = (event as CustomEvent<LiveSyncEvent>).detail;
    if (detail) listener(detail);
  };
  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent<WireEvent>) => {
    if (!event.data || event.data.sourceId === CLIENT_ID) return;
    listener(event.data);
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