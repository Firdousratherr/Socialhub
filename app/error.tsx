"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Socialhub route error", error); }, [error]);
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <section className="social-card w-full max-w-lg rounded-[2rem] p-6 text-center sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle size={24} aria-hidden="true" /></div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.14em] text-[var(--accent)]">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--foreground)]">Socialhub hit an unexpected error.</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Try the page again, or return to your feed.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={() => reset()} className="social-button inline-flex items-center justify-center gap-2 bg-gray-950 text-white"><RefreshCw size={15} aria-hidden="true" /> Try again</button>
          <Link href="/home" className="social-button inline-flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700"><Home size={15} aria-hidden="true" /> Back home</Link>
        </div>
      </section>
    </main>
  );
}