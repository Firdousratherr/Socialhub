"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gray-950 text-white hover:bg-gray-800",
  accent: "bg-[#5a4be8] text-white hover:bg-[#4c3fd0]",
  secondary: "border border-gray-200 bg-white text-gray-800 hover:border-[#cfc9ff] hover:bg-[#f8f7ff]",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-950",
  danger: "border border-red-100 bg-red-50 text-red-700 hover:bg-red-100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-xl px-3 text-xs",
  md: "min-h-11 rounded-2xl px-4 text-sm",
  lg: "min-h-12 rounded-2xl px-5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        "social-button inline-flex items-center justify-center gap-2 font-bold transition duration-150 ease-out active:scale-[.98]",
        variants[variant],
        sizes[size],
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5a4be8]/50",
        disabled || loading ? "cursor-not-allowed opacity-50" : "",
        className,
      ].join(" ")}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
