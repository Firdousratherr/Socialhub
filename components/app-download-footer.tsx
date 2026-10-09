"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Smartphone } from "lucide-react";

export function AppDownloadFooter() {
  const pathname = usePathname();
  if (pathname === "/download" || pathname.startsWith("/download/")) return null;

  return (
    <footer className="border-t border-gray-200 bg-white/95 pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+1rem)] sm:pb-0">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eeebff] text-[#5a4be8]">
            <Smartphone size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black text-gray-900">Get Socialhub on Android</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Download the latest Socialhub APK from the dedicated download page.
            </p>
          </div>
        </div>
        <Link
          href="/download"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white hover:bg-gray-800 sm:w-auto"
        >
          <Download size={15} aria-hidden="true" />
          Download APK
        </Link>
      </div>
    </footer>
  );
}
