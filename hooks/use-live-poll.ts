"use client";

import { useEffect, useRef } from "react";

export function useLivePoll(
  task: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const taskRef = useRef(task);
  const runningRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async () => {
      if (
        cancelled ||
        runningRef.current ||
        document.visibilityState !== "visible" ||
        navigator.onLine === false
      ) {
        return;
      }

      runningRef.current = true;
      try {
        await taskRef.current();
      } catch {
        // Polling is best-effort: a failed request must not create an unhandled rejection
        // or stop future refresh attempts.
      } finally {
        runningRef.current = false;
      }
    };

    void run();

    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onOnline = () => void run();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, intervalMs]);
}
