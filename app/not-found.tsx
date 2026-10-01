"use client";

import Link from "next/link";
import { ArrowLeft, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f7f6ff] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-gray-200/70 bg-white p-8 text-center shadow-[0_18px_60px_rgba(20,24,40,.08)] sm:p-12">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">
            <Search size={23} />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">Page not found</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-gray-950 sm:text-4xl">That page isn’t available.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">The link may be outdated or the page may have moved. Use the navigation below to continue.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
                  window.history.back();
                } else {
                  window.location.assign("/home");
                }
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <Link href="/home" className="inline-flex h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white">
              <Home size={16} /> Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
