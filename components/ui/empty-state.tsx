import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">{icon}</div>
      <h2 className="mt-4 text-base font-extrabold text-gray-950">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-gray-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
