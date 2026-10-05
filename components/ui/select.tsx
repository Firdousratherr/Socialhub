import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={[
          "h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-9 text-xs font-bold text-gray-800 outline-none transition",
          "focus:border-[#bbb3ff] focus:ring-4 focus:ring-[#5a4be8]/10",
          props.className ?? "",
        ].join(" ")}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} aria-hidden="true" />
    </div>
  );
}
