"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bookmark, Compass, Home, MessageCircle, Search, Settings, Sparkles, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { MobileMenu } from "@/components/mobile-menu";
import { BottomNav } from "@/components/bottom-nav";
import { Avatar } from "@/components/ui/avatar";

const navItems = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { summary } = useUnreadSummary();
  const [username, setUsername] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    void fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setUsername(json.profile?.username ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    setSearchOpen(false);
    router.push(query ? "/discover?q=" + encodeURIComponent(query) : "/discover");
  }

  const profileHref = username ? "/profile/" + encodeURIComponent(username) : "/profile/me";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[70] border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-3 sm:px-4 lg:px-6">
          <Link href="/home" className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl p-1" aria-label="Socialhub home">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#6d5dfc] to-[#36b8ff] text-white shadow-md">
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-black tracking-tight text-gray-950">Socialhub</span>
              <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-[#5a4be8]">Connect · Share · Belong</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="relative mx-auto hidden w-full max-w-[520px] md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="social-input h-10 w-full pl-10 pr-16 text-sm"
              placeholder="Search people, posts and hashtags…"
              aria-label="Search Socialhub"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-400 lg:block">Ctrl K</kbd>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setSearchOpen((value) => !value)} className="social-icon-button bg-gray-50 md:hidden" aria-label="Open search" aria-expanded={searchOpen}>
              <Search size={19} aria-hidden="true" />
            </button>
            <Link href="/notifications" className="social-icon-button relative bg-gray-50" aria-label="Notifications">
              <Bell size={19} aria-hidden="true" />
              {summary.notifications > 0 ? <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-black leading-4 text-white">{Math.min(99, summary.notifications)}</span> : null}
            </Link>
            <Link href={profileHref} className="rounded-xl p-1 hover:bg-[#eeebff]" aria-label="Open your profile">
              <Avatar id={session?.user?.id} name={session?.user?.name ?? "You"} image={session?.user?.image} size="sm" />
            </Link>
            <div className="lg:hidden"><MobileMenu /></div>
          </div>
        </div>
        {searchOpen ? (
          <form onSubmit={submitSearch} className="border-t border-gray-100 bg-white px-3 py-3 md:hidden">
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} className="social-input w-full px-4 text-sm" placeholder="Search Socialhub…" aria-label="Search Socialhub" />
          </form>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-3 py-4 sm:px-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 rounded-3xl border border-white/80 bg-white/80 p-2 shadow-sm backdrop-blur-xl" aria-label="Primary navigation">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
              const unread = href === "/messages" ? summary.messages : href === "/notifications" ? summary.notifications : 0;
              return (
                <Link key={href} href={href} data-active={active} className="social-nav-link mb-1" aria-current={active ? "page" : undefined}>
                  <Icon size={19} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-sm">{label}</span>
                  {unread > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[9px] font-black leading-5 text-white">{Math.min(99, unread)}</span> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 mobile-safe-bottom">{children}</main>
      </div>
      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
