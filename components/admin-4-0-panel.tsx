"use client";

import { fetchWithTimeout } from "@/lib/client-fetch";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  History,
  LockKeyhole,
  Shield,
  Users,
  XCircle,
} from "lucide-react";

type Tab = "command" | "cases" | "enforcement" | "risk" | "graph" | "segments" | "integrity" | "limits" | "appeals" | "approvals";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={"rounded-[26px] border border-gray-100 bg-white p-4 shadow-[0_14px_50px_rgba(31,26,64,0.06)] " + className}>{children}</section>;
}
function Btn({ children, onClick, danger = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={"rounded-xl px-3 py-2 text-[10px] font-black transition disabled:opacity-40 " + (danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-gray-950 text-white hover:bg-gray-800")}>{children}</button>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-[#a79dff] " + (props.className ?? "")} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={"h-10 w-full rounded-xl border border-gray-200 bg¶»§q«^