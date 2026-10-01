"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? "Administrator sign-in failed.");
      }

      router.replace("/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Administrator sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#eeebff,transparent_40%),#f6f7fb] p-5">
      <section className="w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-gray-900/10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">
          <ShieldCheck size={26} />
        </div>
        <div className="mt-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d5dfc]">Socialhub</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-gray-950">Administrator login</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Use the administrator credentials configured in your deployment environment.</p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-gray-700">Admin email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-[#bdb6ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-gray-700">Admin password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-[#bdb6ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
              required
            />
          </label>

          {error ? (
            <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {loading ? "Signing in…" : "Sign in as administrator"}
          </button>
        </form>
      </section>
    </main>
  );
}
