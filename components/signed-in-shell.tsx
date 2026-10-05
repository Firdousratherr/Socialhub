"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { MobileMenu } from "@/components/mobile-menu";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

const navItems = [
  { label: "Home", icon: Home, href: "/home" },
  { label: "Discover", icon: Compass, href: "/discover" },
  { label: "Friends", icon: Users, href: "/friends" },
  { label: "Messages", icon: MessageCircle, href: "/messages" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
];

function Avatar({ name, image }: { name: string; image?: string | null }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return image ? (
    <img src={image} alt={name} className="size-9 rounded-full object-cover shadow-sm" />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-extrabold text-white shadow-sm">
      {initials}
    </span>
  );
}

export function SignedInShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { summary: unreadSummary } = useUnreadSummary();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setUsername(null);
      return;
    }

    let cancelled = false;
    void fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setUsername(json.profile?.username ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchTerm.trim();
    router.push(query ? `/discover?q=${encodeURIComponent(query)}` : "/discover");
  }

  const profileHref = username ? `/profile/${encodeURIComponent(username)}` : "/profile/me";

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/88 shadow-[0_10px_35px_rgba(23,20,45,.06)] backdrop-blur-2xl">
        <div className="h-0.5 bg-gradient-to-r from-[#6d5dfc] via-[#9c7cff] to-[#36b8ff]" />
        <div className="mx-auto flex h-[74px] max-w-[1440px] items-center gap-3 px-3 sm:px-6 lg:px-8">
          <Link href="/home" className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-2xl px-1 py-1" aria-label="Socialhub home">
            <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#6d5dfc] via-[#856fff] to-[#36b8ff] text-white shadow-lg shadow-[#6d5dfc]/25 transition duration-200 group-hover:-translate-y-0.5">
              <Sparkles size={18} strokeWidth={2.2} />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-[15px] font-black tracking-[-.035em] text-gray-950">Socialhub</span>
              <span className="block text-[9px] font-bold uppercase tracking-[.18em] text-[#7c72c8]">Connect · Share · Belong</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="relative mx-auto hidden w-full max-w-lg flex-1 md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-2xl border border-gray-200/80 bg-gray-50/90 pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-gray-400 focus:border-[#bbb3ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
              placeholder="Search people, posts and hashtags…"
              aria-label="Search Socialhub"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setSearchOpen((value) => !value)} className="social-icon-button rounded-2xl border border-transparent bg-gray-50 md:hidden" aria-label="Search" aria-expanded={searchOpen}>
              <Search size={19} />
            </button>
            <Link href="/notifications" className="social-icon-button relative rounded-2xl border border-transparent bg-gray-50 hover:border-[#e3defe] hover:bg-[#f8f6ff]" aria-label="Notifications">
              <Bell size={19} />
              {unreadSummary.notifications > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-black leading-4 text-white">
                  {Math.min(99, unreadSummary.notifications)}
                </span>
              ) : null}
            </Link>
            <Link href={profileHref} className="ml-0.5 rounded-2xl p-0.5 transition hover:bg-[#eeebff]" aria-label="Your profile">
              <Avatar name={session?.user?.name ?? "You"} image={session?.user?.image} />
            </Link>
            <MobileMenu />
          </div>
        </div>
      </header>

        {searchOpen ? (
          <form onSubmit={submitSearch} className="border-t border-gray-100 bg-white/95 px-3 py-3 sm:px-6 md:hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                autoFocus
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm font-medium outline-none focus:border-[#bbb3ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
                placeholder="Search Socialhub…"
                aria-label="Search Socialhub"
              />
            </div>
          </form>
        ) : null}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="mb-4 rounded-3xl border border-white/70 bg-white/70 p-2.5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3 rounded-2xl bg-[#f5f2ff] p-3">
                <Link href={profileHref}>
                  <Avatar name={session?.user?.name ?? "Your profile"} image={session?.user?.image} />
                </Link>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">Your profile</p>
                  <p className="truncate text-xs font-medium text-gray-400">@{username ?? "member"}</p>
                </div>
              </div>
              <nav className="mt-2 space-y-1" aria-label="Primary navigation">
                {navItems.map(({ label, icon: Icon, href }) => {
                  const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
                  return (
                    <Link key={label} href={href} data-active={active} className="social-nav-link">
                      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                      <span className="text-sm">{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="my-3 border-t border-gray-100" />
              <Link href="/saved" className={"social-nav-link " + (pathname.startsWith("/saved") ? "bg-[#eeebff] text-[#5a4be8]" : "")}>
                <Bookmark size={18} />
                <span className="text-sm font-semibold">Saved posts</span>
              </Link>
              <Link href="/settings" className={"social-nav-link " + (pathname.startsWith("/settings") ? "bg-[#eeebff] text-[#5a4be8]" : "")}>
                <Settings size={18} />
                <span className="text-sm font-semibold">Settings</span>
              </Link>
            </div>
            <p className="px-3 text-[11px] font-medium leading-5 text-gray-400">Built for thoughtful sharing, meaningful connections, and everyday moments.</p>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
