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
    <nav
      className="fixed inset-x-2 bottom-2 z-[60] rounded-[1.4rem] border border-white/80 bg-[#141225]/96 p-1.5 shadow-[0_18px_55px_rgba(20,18,44,.28)] backdrop-blur-2xl md:hidden"
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
              className={"relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-black transition " + (active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white")}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
              {active ? <span className="absolute bottom-1 size-1 rounded-full bg-[#8b7dff]" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
 );
}
