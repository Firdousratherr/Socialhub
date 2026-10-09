import { Download, Smartphone } from "lucide-react";
import { getSystemSetting } from "@/lib/platform-controls";
import { getAndroidApkUrl } from "@/lib/app-download";

export const dynamic = "force-dynamic";

export default async function DownloadPage() {
  const downloadUrl = await getAndroidApkUrl(getSystemSetting);

  return (
    <main className="min-h-[100svh] bg-[#f6f7fb] px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <section className="mx-auto flex min-h-[calc(100svh-5rem-env(safe-area-inset-bottom))] max-w-xl flex-col items-center justify-center py-8 text-center">
        <span className="grid size-16 place-items-center rounded-[1.4rem] bg-[#eeebff] text-[#5a4be8] shadow-sm">
          <Smartphone size={30} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
          Download Socialhub
        </h1>
        <p className="mt-2 text-sm font-medium text-gray-500">Socialhub for Android</p>
        <a
          href={downloadUrl}
          download="Socialhub.apk"
          className="mt-8 inline-flex min-h-14 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-[#5a4be8] px-6 text-base font-black text-white shadow-[0_14px_35px_rgba(90,75,232,0.28)] transition hover:bg-[#4c3fd0] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#c9c3ff] active:scale-[0.99] sm:w-auto sm:min-w-64"
          aria-label="Download Socialhub Android APK"
        >
          <Download size={20} aria-hidden="true" />
          Download APK
        </a>
      </section>
    </main>
  );
}
