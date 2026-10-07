"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { APP_DOWNLOAD_SETTING_KEY, DEFAULT_ANDROID_APK_URL } from "@/lib/app-download";

type Props = { refreshKey?: number };

export function AdminAppDownloadSettings({ refreshKey = 0 }: Props) {
  const [url, setUrl] = useState(DEFAULT_ANDROID_APK_URL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/control-center", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load application settings.");
      const value = (json.settings ?? []).find((item: { key: string; value: string }) => item.key === APP_DOWNLOAD_SETTING_KEY)?.value;
      setUrl(String(value ?? DEFAULT_ANDROID_APK_URL));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load application settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  async function save() {
    const next = url.trim();
    if (!next) {
      setNotice("Enter a direct APK URL.");
      return;
    }
    if (!/^https:\/\//i.test(next)) {
      setNotice("Use an HTTPS URL.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/control-center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "setting",
          key: APP_DOWNLOAD_SETTING_KEY,
          value: next,
          description: "Direct Android APK download URL controlled by Socialhub administrators.",
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not save the APK URL.");
      setUrl(String(json.setting?.value ?? next));
      setNotice("APK download link saved and audited.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the APK URL.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(31,26,64,0.05)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">
          <Download size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black">Android app download</h3>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            Set the direct APK asset used by the public download page and site footer. Update this URL whenever a new APK release is published.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={loading || saving}
          placeholder="https://github.com/.../app-release.apk"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs outline-none focus:border-[#a79dff] focus:bg-white disabled:opacity-60"
          aria-label="Direct Android APK download URL"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving || !url.trim()}
          className="min-h-11 rounded-xl bg-gray-950 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save APK link"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px]">
        <span className="break-all text-gray-400">{url}</span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-black text-[#5a4be8] hover:underline">
            Test direct asset <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      {notice ? <p role="status" className="mt-3 rounded-xl bg-[#f8f7ff] px-3 py-2 text-[10px] font-bold text-[#5a4be8]">{notice}</p> : null}
    </section>
  );
}
