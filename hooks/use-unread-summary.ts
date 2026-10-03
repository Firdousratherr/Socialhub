"use client";

import { useCallback, useEffect, useState } from "react";
import { emitLiveSync, subscribeLiveSync } from "@/lib/live-sync";

export type UnreadSummary = {
  messages: number;
  notifications: number;
  friendRequests: number;
  total: number;
};

const EMPTY: UnreadSummary = {
  messages: 0,
  notifications: 0,
  friendRequests: 0,
  total: 0,
};

let cached: UnreadSummary = EMPTY;
const listeners = new Set<(summary: UnreadSummary) => void>();
let timer: number | null = null;
let inFlight = false;

function publish(next: UnreadSummary) {
  cached = next;
  listeners.forEach((listener) => listener(next));
}

async function refreshUnreadSummary() {
  if (inFlight || typeof window === "undefined" || document.visibilityState !== "visible" || navigator.onLine === false) return;
  inFlight = true;
  try {
    const response = await fetch("/api/unread-summary", { cache: "no-store" });
    if (!response.ok) return;
    const json = (await response.json()) as Partial<UnreadSummary>;
    publish({
      messages: Number(json.messages ?? 0),
      notifications: Number(json.notifications ?? 0),
      friendRequests: Number(json.friendRequests ?? 0),
      total: Number(json.total ?? 0),
    });
  } catch {
    // Preserve the last known state when the network is unavailable.
  } finally {
    inFlight = false;
  }
}

function startSharedPolling() {
  if (timer !== null || typeof window === "undefined") return;
  timer = window.setInterval(() => void refreshUnreadSummary(), 8000);
}

function stopSharedPolling() {
  if (timer === null || typeof window === "undefined") return;
  window.clearInterval(timer);
  timer = null;
}

export function emitUnreadSummarySync() {
  if (typeof window === "undefined") return;
  emitLiveSync({ type: "read-state-changed" });
}

export function useUnreadSummary() {
  const [summary, setSummary] = useState<UnreadSummary>(cached);

  const refresh = useCallback(async () => {
    await refreshUnreadSummary();
  }, []);

  useEffect(() => {
    listeners.add(setSummary);
    setSummary(cached);
    startSharedPolling();
    void refreshUnreadSummary();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUnreadSummary();
    };
    document.addEventListener("visibilitychange", onVisible);

    const unsubscribeLive = subscribeLiveSync((event) => {
      if (
        event.type === "message-created" ||
        event.type === "notification-created" ||
        event.type === "friend-request-changed" ||
        event.type === "read-state-changed"
      ) {
        void refreshUnreadSummary();
      }
    });

    return () => {
      listeners.delete(setSummary);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribeLive();
      if (!listeners.size) stopSharedPolling();
    };
  }, []);

  return { summary, refresh };
}
