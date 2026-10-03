export type LiveSyncEvent =
  | { type: "post-created" | "post-updated" | "post-deleted" | "comment-created" | "comment-updated" | "comment-deleted"; postId?: string; commentId?: string }
  | { type: "message-created" | "message-updated" | "message-deleted"; conversationId: string; messageId?: string }
  | { type: "notification-created" | "friend-request-changed" | "read-state-changed"; id?: string };

const CHANNEL_NAME = "socialhub-live-sync";
type Listener = (event: LiveSyncEvent) => void;

export function emitLiveSync(event: LiveSyncEvent) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent<LiveSyncEvent>(CHANNEL_NAME, { detail: event }));

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  } catch {
    // BroadcastChannel is unavailable in some browsers/webviews.
  }
}

export function subscribeLiveSync(listener: Listener) {
  if (typeof window === "undefined") return () => undefined;

  const onWindowEvent = (event: Event) => {
    const detail = (event as CustomEvent<LiveSyncEvent>).detail;
    if (detail) listener(detail);
  };

  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent<LiveSyncEvent>) => {
    if (event.data) listener(event.data);
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
