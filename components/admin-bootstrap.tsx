"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AdminBootstrap() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim() || loading) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not complete admin setup.");

      setToken("");
      router.push("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete admin setup.");
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return <main className="grid min-h-screen place-items-center bg-[#f8f8fc] p-6"><div className="rounded-3xl bg-white p-6 text-sm text-gray-500 shadow-xl">Checking your session…</div></main>;
  }

  if (!session?.user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f8fc] p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#6d5dfc]">Admin setup</p>
          <h1 className="mt-2 text-2xl font-black">Sign in first</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Create your normal Socialhub account, sign in, then return to this page to promote that account to administrator.</p>
          <a href="/login" className="mt-5 inline-flex rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white">Sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#e9e5ff,transparent_38%),#f8f8fc] p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_30px_80px_rgba(28,23,63,.12)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#6d5dfc]">Socialhub administrator</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Finish admin setup</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">This one-time step promotes the account you are currently signed in with. The setup endpoint closes after the first administrator is created.</p>
        <label className="mt-6 block">
          <span className="mb-2 block text-xs font-black text-gray-600">Bootstrap token</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
            minLength={32}
            className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 font-mono text-sm outline-none focus:border-[#9d94ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
            placeholder="Paste the one-time token"
          />
        </label>
        {message ? <div role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{message}</div> : null}
        <button disabled={loading || token.trim().length < 32} className="mt-5 h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? "Setting up…" : "Make me administrator"}
        </button>
        <p className="mt-4 text-[11px] leading-5 text-gray-400">Never place the bootstrap token in source control. Remove or rotate it in Vercel after setup.</p>
      </form>
    </main>
  );
}
