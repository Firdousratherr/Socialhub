"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";

type Announcement = { id: string; title: string; body: string };
const DISMISSED_KEY = "socialhub:dismissed-announcements";
function readDismissed() {
  try { const value = window.localStorage.getItem(DISMISSED_KEY); return new Set<string>(value ? JSON.parse(value) : []); } catch { return new Set<string>(); }
}
function writeDismissed(ids: Set<string>) { try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch {} }

export function PlatformAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/announcements", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load announcements.");
        const json = await response.json();
        if (!cancelled) setItems(Array.isArray(json.announcements) ? json.announcements : []);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);
  const dismissed = useMemo(() => readDismissed(), []);
  const visible = items.filter((item) => !dismissed.has(item.id)).slice(0, 2);
  function dismiss(id: string) { const next = new Set(dismissed); next.add(id); writeDismissed(next); setItems((current) => current.filter((item) => item.id !== id)); }
  if (!visible.length) return null;
  return <div className="mx-auto max-w-[1440px] space-y-2 px-3 pt-3 sm:px-5 lg:px-7">{visible.map((item) => <aside key={item.id} className="social-card rounded-2xl bg-[var(--accent-soft)] p-3.5" aria-label="Platform announcement"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)] shadow-sm"><Bell size={16} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-xs font-black text-[var(--foreground)]">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.body}</p></div><button type="button" onClick={() => dismiss(item.id)} className="grid size-9 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]" aria-label="Dismiss announcement"><X size={15} aria-hidden="true" /></button></div></aside>)}</div>;
}