"use client";

import { useLayoutEffect, type ReactNode } from "react";

const THEME_KEY = "socialhub:theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const applyTheme = (value: string | null) => {
      const theme = value === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_KEY);
    } catch {
      stored = null;
    }
    applyTheme(stored);

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) applyTheme(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <>{children}</>;
}
