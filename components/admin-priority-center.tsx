"use client";

import { CheckCircle2, CircleDot, Layers3 } from "lucide-react";
import { SOCIALHUB_PRIORITIES } from "@/lib/socialhub-priorities";

function statusClass(status: string) {
  if (status === "LIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "EXTENDED") return "bg-[#eeebff] text-[#5a4be8]";
  if (status === "IN_PROGRESS") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export function AdminPriorityCenter() {
  const live = SOCIALHUB_PRIORITIES.filter((item) => item.status === "LIVE").length;
  const extended = SOCIALHUB_PRIORITIES.filter((item) => item.status === "EXTENDED").length;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_14px_50px_rgba(31,26,64,0.06)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Layers3 size={19}/></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#6d5dfc]">Product roadmap</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">12-priority Socialhub control view</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">These are the active product layers being completed on the same platform foundation.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Priorities" value={SOCIALHUB_PRIORITIES.length} />
          <Metric label="Live" value={live} />
          <Metric label="Extended" value={extended} />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {SOCIALHUB_PRIORITIES.map((item) => (
          <section key={item.id} className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(31,26,64,0.04)]">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gray-50 text-xs font-black text-gray-500">{item.id}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-gray-950">{item.title}</h3>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black ${statusClass(item.status)}`}>{item.status}</span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-gray-500">{item.summary}</p>
              </div>
              <StatusIcon status={item.status} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-gray-50 p-4"><p className="text-2xl font-black text-gray-950">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.14em] text-gray-400">{label}</p></div>;
}
function StatusIcon({ status }: { status: string }) {
  return status === "LIVE" ? <CheckCircle2 className="mt-1 shrink-0 text-emerald-500" size={17}/> : <CircleDot className={`mt-1 shrink-0 ${status === "IN_PROGRESS" ? "text-amber-500" : "text-[#6d5dfc]"}`} size={17}/>;
}
