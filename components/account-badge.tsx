import { Check, Crown } from "lucide-react";

type AccountBadgeProps = {
  verified?: boolean;
  owner?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
};

export function AccountBadge({ verified = false, owner = false, size = "sm", showLabel = false }: AccountBadgeProps) {
  if (!verified && !owner) return null;
  const compact = size === "sm";
  if (owner) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700 ring-1 ring-amber-200"
        title="Socialhub platform owner"
        aria-label="Socialhub platform owner"
      >
        <Crown size={compact ? 10 : 12} strokeWidth={2.5} />
        {showLabel ? "Owner" : null}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700 ring-1 ring-blue-200"
      title="Verified Socialhub account"
      aria-label="Verified Socialhub account"
    >
      <span className="grid size-3.5 place-items-center rounded-full bg-blue-600 text-white">
        <Check size={9} strokeWidth={3} />
      </span>
      {showLabel ? "Verified" : null}
    </span>
  );
}
