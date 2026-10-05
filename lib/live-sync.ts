export type LiveSyncEvent =
  | { type: "post-created" | "post-updated" | "post-deleted" | "comment-created" | "comment-updated" | "comment-deleted"; postId?: string; commentId?: string }
  | { type: "message-created" | "message-updated" | "message-deleted"; conversationId: string; messageId?: string }
  | { type: "notification-created" | "friend-request-changed" | "read-state-changed"; id?: string }
  | { type: "follow-updated"; userId: string; following: boolean };

const CHANNEL_NAME = "socialhub-live-sync";
const CLIENT_ID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : "client-" + Date.now() + "-" + Math.random().toString(36).slice(2);
type WireEvent = LiveSyncEvent & { sourceId: string };
type Listener = (event: LiveSyncEvent) => void;

export function emitLiveSync(event: LiveSyncEvent) {
  if (typeof window === "undefined") return;

  const wireEvent: WireEvent = { ...event, sourceId: CLIENT_ID };
  window.dispatchEvent(new CustomEvent<WireEvent>(CHANNEL_NAME, { detail: wireEvent }));

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ ...event, sourceId: CLIENT_ID } as WireEvent);
    channel.close();
  } catch {
    // BroadcastChannel is unavailable in some browsers/webviews.
  }
}

export function subscribeLiveSync(listener: Listener) {
  if (typeof window === "undefined") return () => undefined;

  const onWindowEvent = (event: Event) => {
    const detail = (event as CustomEvent<WireEvent>).detail;
    if (!detail) return;
    const { sourceId: _sourceId, ...payload } = detail;
    listener(payload);
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
