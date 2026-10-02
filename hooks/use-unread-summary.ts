"use client";

import { useCallback, useEffect, useState } from "react";

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

export function useUnreadSummary() {
  const [summary, setSummary] = useState<UnreadSummary>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/unread-summary", { cache: "no-store" });
      if (!response.ok) return;
      const json = (await response.json()) as Partial<UnreadSummary>;
      setSummary({
        messages: Number(json.messages ?? 0),
        notifications: Number(json.notifications ?? 0),
        friendRequests: Number(json.friendRequests ?? 0),
        total: Number(json.total ?? 0),
      });
    } catch {
      // Keep the last known summary when the network is unavailable.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return { summary, refresh };
}
