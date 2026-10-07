"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Phone, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";

type CallRow = {
  id: string;
  type: "AUDIO" | "VIDEO";
  status: string;
  direction: "INCOMING" | "OUTGOING";
  createdAt: string;
  endedAt?: string | null;
  peer?: { id: string; name: string; username?: string | null; image?: string | null };
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/calls?take=100", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load call history.");
        setCalls(json.calls ?? []);
      })
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[860px] px-3 py-4 sm:px-5 sm:py-6">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#6d5dfc]">Communication</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Calls</h1>
          <p className="mt-1 text-sm text-gray-500">Recent voice and video calls.</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading call history…</div>
          ) : !calls.length ? (
            <div className="p-10 text-center text-sm text-gray-500">No calls yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {calls.map((call) => {
                const VideoIcon = call.type === "VIDEO" ? Video : Phone;
                const DirectionIcon = call.direction === "INCOMING" ? ArrowDownLeft : ArrowUpRight;
                return (
                  <div key={call.id} className="flex items-center gap-3 p-4 sm:p-5">
                    {call.peer?.image ? (
                      <img src={call.peer.image} alt="" className="size-11 rounded-full object-cover" />
                    ) : (
                      <div className="grid size-11 place-items-center rounded-full bg-[#eeebff] text-sm font-black text-[#5a4be8]">{call.peer?.name?.slice(0, 1).toUpperCase() ?? "S"}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-900">{call.peer?.name ?? "Socialhub member"}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                        <DirectionIcon size={13} />
                        <VideoIcon size={13} />
                        {call.type === "VIDEO" ? "Video call" : "Voice call"} · {call.status.toLowerCase()} · {formatDate(call.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
