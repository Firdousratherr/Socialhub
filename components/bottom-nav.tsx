"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, MessageCircle, Users, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useUnreadSummary } from "@/hooks/use-unread-summary";

const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/profile/me", label: "Profile", Icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { summary } = useUnreadSummary();
  if (!session?.user) return null;

  return (
    <nav
      className="fixed inset-x-2 bottom-2 z-[60] rounded-[1.4rem] border border-white/80 bg-[#141225]/96 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_18px_55px_rgba(20,18,44,.28)] backdrop-blur-2xl md:hidden"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/home"
            ? pathname === "/home"
            : href === "/profile/me"
              ? pathname.startsWith("/profile")
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={"relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-black transition " + (active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white")}
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
