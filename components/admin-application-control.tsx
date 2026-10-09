"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { isDirectApkUrl } from "@/lib/app-download";

type Feature = {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  enabled: boolean;
  updatedAt: string | null;
  configured: boolean;
};

type ControlResponse = {
  features: Feature[];
  apk: { url: string; configured: boolean };
  currentAdmin: { id: string; role: "ADMIN" | "MODERATOR" };
};

const ICONS: Record<string, typeof Users> = {
  "registration.enabled": UserPlus,
  "platform.posts.enabled": ImageIcon,
  "platform.comments.enabled": MessageCircle,
  "platform.messaging.enabled": MessageCircle,
  "platform.uploads.enabled": Upload,
  "platform.stories.enabled": Smartphone,
  "platform.social.enabled": Users,
};

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "The request could not be completed.");
  }
  return body;
}

export function AdminApplicationControl() {
  const [data, setData] = useState<ControlResponse | null>(null);
  const [apkUrl, setApkUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingApk, setSavingApk] = useState(false);
  const [busyFeature, setBusyFeature] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/application-control", { cache: "no-store" });
      const json = (await responseJson(response)) as ControlResponse;
      setData(json);
      setApkUrl(json.apk.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load application controls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFeature(feature: Feature) {
    const enabled = !feature.enabled;
    if (!enabled && !window.confirm(
      "Turn off " + feature.label + "? This will block the corresponding action for users across clients."
    )) return;

    setBusyFeature(feature.key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/application-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "platform",
          key: feature.key,
          enabled,
          reason: "Changed in the Socialhub web application-control panel.",
        }),
      });
      const json = await responseJson(response) as { feature: Feature };
      setData((current) => current
        ? { ...current, features: current.features.map((item) => item.key === feature.key ? json.feature : item) }
        : current);
      setNotice(feature.label + " is now " + (enabled ? "enabled." : "disabled.") + " The change was audited.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this platform control.");
    } finally {
      setBusyFeature(null);
    }
  }

  async function saveApk() {
    const value = apkUrl.trim();
    if (!isDirectApkUrl(value)) {
      setError("Use a direct HTTPS download URL ending in .apk.");
      setNotice("");
      return;
    }

    setSavingApk(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/application-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "apk",
          value,
          reason: "Changed in the Socialhub web application-control panel.",
        }),
      });
      const json = await responseJson(response) as { apk: ControlResponse["apk"] };
      setApkUrl(json.apk.url);
      setData((current) => current ? { ...current, apk: json.apk } : current);
      setNotice("Android APK download link saved and audited.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the APK download link.");
    } finally {
      setSavingApk(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_12px_35px_rgba(31,26,64,0.05)]">
        <div className="bg-gray-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
                <Smartphone size={21} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Platform settings</p>
                <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Application control</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/65">
                  Control core Socialhub actions from one place. These switches update server-side settings rather than merely hiding buttons in the interface.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh application controls"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/15 px-3 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold text-white/50">Available controls</p>
              <p className="mt-1 text-xl font-black">{data?.features.length ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold text-white/50">Enabled</p>
              <p className="mt-1 text-xl font-black">{data ? data.features.filter((feature) => feature.enabled).length : "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold text-white/50">Audit trail</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-black"><ShieldCheck size={15} /> Enabled</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading && !data ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-sm font-semibold text-gray-500" role="status">
              <Activity size={17} className="animate-pulse" /> Loading platform controls…
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">
              <XCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          ) : null}
          {notice ? (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800" role="status">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" /><span>{notice}</span>
            </div>
          ) : null}

          {data ? (
            <>
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-950">Core platform switches</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Disabling a service blocks the corresponding API action. Existing records are preserved.</p>
                </div>
                <p className="text-[10px] text-gray-400">Changes apply when the next request reaches the server.</p>
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {data.features.map((feature) => {
                  const Icon = ICONS[feature.key] ?? ShieldCheck;
                  const busy = busyFeature === feature.key;
                  return (
                    <article key={feature.key} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 p-4 transition hover:border-violet-200 hover:shadow-sm">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-gray-950">{feature.label}</h4>
                          <p className="mt-1 text-xs leading-5 text-gray-500">{feature.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                        <span className={"inline-flex items-center gap-1.5 text-[11px] font-extrabold " + (feature.enabled ? "text-emerald-700" : "text-red-700")}>
                          <span className={"size-2 rounded-full " + (feature.enabled ? "bg-emerald-500" : "bg-red-500")} />
                          {feature.enabled ? "Enabled" : "Disabled"}
                          {!feature.configured ? <span className="font-medium text-gray-400">· default</span> : null}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={feature.enabled}
                          aria-label={(feature.enabled ? "Disable " : "Enable ") + feature.label}
                          disabled={busy || loading}
                          onClick={() => void toggleFeature(feature)}
                          className={"inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 " + (feature.enabled ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "bg-gray-950 text-white hover:bg-gray-800")}
                        >
                          {busy ? <RefreshCw size={13} className="animate-spin" /> : null}
                          {busy ? "Saving…" : feature.enabled ? "Turn off" : "Turn on"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_12px_35px_rgba(31,26,64,0.05)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
            <Download size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-gray-950">Android app distribution</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">Set the direct APK URL used by the public download page. The server rejects non-HTTPS links and URLs that do not end in .apk.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-bold text-gray-600">Direct APK URL</span>
            <input
              type="url"
              inputMode="url"
              value={apkUrl}
              onChange={(event) => setApkUrl(event.target.value)}
              disabled={loading || savingApk}
              placeholder="https://example.com/socialhub.apk"
              aria-label="Direct Android APK download URL"
              className="min-h-12 w-full min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveApk()}
            disabled={loading || savingApk || !apkUrl.trim()}
            className="min-h-12 self-end rounded-xl bg-gray-950 px-4 text-xs font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:mb-0"
          >
            {savingApk ? "Saving…" : "Save APK link"}
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-[10px] sm:flex-row sm:items-center sm:justify-between">
          <span className="break-all text-gray-400">{data?.apk.configured ? "Custom APK URL saved" : "Using default APK URL"}</span>
          {isDirectApkUrl(apkUrl.trim()) ? (
            <a href={apkUrl.trim()} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 self-start font-black text-violet-700 hover:underline">
              Test download link <Download size={13} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </section>

      <p className="px-1 text-[10px] leading-5 text-gray-400">
        Important: controls are available only to administrators or moderators granted the Platform Settings permission. Platform changes and APK link updates are recorded in the admin audit trail. This area does not remotely access a user’s phone, camera, microphone, files, or other apps.
      </p>
    </div>
  );
}
