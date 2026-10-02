export type PostSyncEvent =
  | { type: "created"; postId: string }
  | { type: "updated"; postId: string }
  | { type: "deleted"; postId: string }
  | { type: "visibility-changed"; postId: string }
  | { type: "pinned"; postId: string; pinned: boolean };

const CHANNEL_NAME = "socialhub-post-sync";

type PostSyncListener = (event: PostSyncEvent) => void;

export function emitPostSyncEvent(event: PostSyncEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PostSyncEvent>(CHANNEL_NAME, { detail: event }));
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
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
  const onChannelMessage = (event: MessageEvent<PostSyncEvent>) => {
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
