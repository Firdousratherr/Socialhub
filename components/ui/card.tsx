import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...props}
      className={[
        "social-card rounded-2xl border border-gray-200/70 bg-white p-4 md:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
