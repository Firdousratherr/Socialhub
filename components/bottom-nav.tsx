"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, MessageCircle, Users, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

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
  if (!session?.user) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-gray-200/80 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(17,24,39,.10)] backdrop-blur-xl md:hidden" aria-label="Primary navigation">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
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
              className={"relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition " + (active ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500 hover:bg-gray-50")}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
              {active ? <span className="absolute bottom-1.5 size-1 rounded-full bg-[#6d5dfc]" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
