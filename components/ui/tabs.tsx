"use client";

import type { ReactNode } from "react";

export function Tabs({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["relative min-w-0 overflow-hidden", className].join(" ")}>
      <div className="flex snap-x gap-1 overflow-x-auto scrollbar-none scroll-smooth px-1 pb-1">{children}</div>
    </div>
  );
}

export function Tab({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      {...props}
      className={[
        "min-h-10 shrink-0 snap-start rounded-xl px-3 text-xs font-bold transition",
        active ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5a4be8]/50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
