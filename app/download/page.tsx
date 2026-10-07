import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, Smartphone, ShieldCheck } from "lucide-react";
import { getSystemSetting } from "@/lib/platform-controls";
import { getAndroidApkUrl } from "@/lib/app-download";

export const dynamic = "force-dynamic";

const RELEASE_VERSION = "1.0.6";

export default async function DownloadPage() {
  const downloadUrl = await getAndroidApkUrl(getSystemSetting);

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-black text-gray-500 hover:text-gray-950"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to Socialhub
        </Link>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-gray-200 bg-gray-950 text-white shadow-[0_24px_80px_rgba(12,10,24,0.18)]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-violet-200">
                <Smartphone size={13} aria-hidden="true" />
                Android app
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Download Socialhub.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                Install the Socialhub Android app directly. The download button points to the APK file, not the GitHub release page.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold text-white/70">
                <span className="rounded-full bg-white/10 px-3 py-1.5">Version {RELEASE_VERSION}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">APK</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">Direct file download</span>
              </div>

              <a
                href={downloadUrl}
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-gray-950 shadow-lg hover:bg-violet-50"
                aria-label={"Download Socialhub Android APK version " + RELEASE_VERSION}
              >
                <Download size={17} aria-hidden="true" />
                Download APK
              </a>

              <p className="mt-3 max-w-lg text-[11px] leading-5 text-white/45">
                Android may ask you to allow installation from this source. Only install APKs you trust.
              </p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black">Release information</p>
                  <p className="mt-1 text-[11px] text-white/45">Use the download button for the APK file.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-xs text-white/70">
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-300" /> Direct APK asset URL</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-300" /> No GitHub release-page redirect</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-300" /> Admin-configurable release link</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
