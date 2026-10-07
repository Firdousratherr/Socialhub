import { AppState } from "react-native";
import { apiFetch } from "./api";

export type RealtimeEvent = {
  id: string;
  type: string;
  conversationId?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
};

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();
let running = false;
let cursor: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function tick() {
  if (!running || AppState.currentState !== "active") return;

  try {
    const query = cursor ? "?cursor=" + encodeURIComponent(cursor) + "&take=100" : "?take=50";
    const data = await apiFetch<{
      events: RealtimeEvent[];
      nextCursor: string | null;
    }>("/api/realtime" + query);

    for (const event of data.events ?? []) {
      for (const listener of listeners) listener(event);
    }

    if (data.nextCursor) cursor = data.nextCursor;
  } catch {
    // The next cycle retries automatically.
  }
}

function schedule() {
  if (!running) return;
  if (timer) clearTimeout(timer);
  const delay = AppState.currentState === "active" ? 2_000 : 10_000;
  timer = setTimeout(async () => {
    await tick();
    schedule();
  }, delay);
}

export function subscribeRealtime(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startRealtime() {
  if (running) return () => {};

  running = true;
  cursor = null;
  void tick().finally(schedule);

  const subscription = AppState.addEventListener("change", (state) => {
    if (!running) return;
    if (state === "active") {
      void tick().finally(schedule);
    } else {
      if (timer) clearTimeout(timer);
      timer = null;
    }
  });

  return () => {
    running = false;
    listeners.clear();
    cursor = null;
    if (timer) clearTimeout(timer);
    timer = null;
    subscription.remove();
  };
}
