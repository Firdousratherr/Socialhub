"use client";


import NextImage from "next/image";
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
      ¶»§q«^