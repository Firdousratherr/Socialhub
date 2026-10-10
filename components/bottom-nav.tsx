"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, MessageCircle, PlusCircle, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useUnreadSummary } from "@/hooks/use-unread-summary";

const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/home?create=1", label: "Create", Icon: PlusCircle, primaryAction: true },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/profile/me", label: "Profile", Icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { summary } = useUnreadSummary();
  if (!session?.user) return null;

  return (
    <nav
      className="social-bottom-nav fixed inset-x-2 bottom-2 z-[60] rounded-[1.4rem] px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ href, label, Icon, primaryAction }) => {
          const active = primaryAction ? false : href === "/home"
            ? pathname === "/home"
            : href === "/profile/me"
              ? pathname.startsWith("/profile")
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={(event) => {
                if (!primaryAction) return;
                if (pathname !== "/home") return;
                event.preventDefault();
                const composer = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Create a post"]');
                composer?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
                composer?.focus({ preventScroll: true });
              }}
              data-create-action={primaryAction ? "true" : undefined}
              aria-current={active ? "page" : undefined}
              aria-label={primaryAction ? "Create a post" : label}
              className={"social-bottom-link relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-black transition " + (primaryAction ? "px-1" : active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-muted)]")}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
              {(
                label === "Messages" ? summary.messages :
                label === "Notifications" ? summary.notifications :
                label === "Friends" ? summary.friendRequests :
                0
              ) > 0 ? (
                <span className="absolute right-2 top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-black leading-4 text-white">
                  {Math.min(99, label === "Messages" ? summary.messages : label === "Notifications" ? summary.notifications : summary.friendRequests)}
                </span>
              ) : null}
              {active ? <span className="absolute bottom-1 size-1 rounded-full bg-[#8b7dff]" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
