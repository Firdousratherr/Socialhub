"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bookmark, Compass, Home, LogOut, MessageCircle, Search, Settings, Sparkles, User, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { MobileMenu } from "@/components/mobile-menu";
import { PlatformAnnouncements } from "@/components/platform-announcements";
import { BottomNav } from "@/components/bottom-nav";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/social-ui";
import CallPanel, { type WebCall } from "@/components/call-panel";
import { useLivePoll } from "@/hooks/use-live-poll";

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
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    users: Array<{ id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }>;
    posts: Array<{ id: string; content: string | null; author: { name: string; username: string | null } }>;
    hashtags: Array<{ tag: string; count: number }>;
  }>({ users: [], posts: [], hashtags: [] });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [incomingCall, setIncomingCall] = useState<WebCall | null>(null);
  const callRealtimeCursorRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useLivePoll(async () => {
    if (!session?.user?.id || incomingCall) return;
    const cursor = callRealtimeCursorRef.current;
    const response = await fetch("/api/realtime" + (cursor ? "?cursor=" + encodeURIComponent(cursor) + "&take=100" : "?take=100"), { cache: "no-store" });
    if (!response.ok) return;
    const json = await response.json();
    callRealtimeCursorRef.current = json.nextCursor ?? callRealtimeCursorRef.current;
    for (const event of json.events ?? []) {
      if (event.type !== "call.incoming" || !event.entityId) continue;
      const ageMs = Date.now() - new Date(event.createdAt ?? 0).getTime();
      if (ageMs < 0 || ageMs > 60_000) continue;
      const callResponse = await fetch("/api/calls/" + event.entityId, { cache: "no-store" });
      if (!callResponse.ok) continue;
      const callJson = await callResponse.json();
      if (callJson.call?.calleeId === session.user.id && callJson.call?.status === "RINGING") {
        setIncomingCall(callJson.call as WebCall);
        break;
      }
    }
  }, 1200, Boolean(session?.user?.id));

  useEffect(() => {
    if (!session?.user?.id) setIncomingCall(null);
  }, [session?.user?.id]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchResultsOpen(true);
      }
      if (event.key === "Escape") {
        setSearchResultsOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults({ users: [], posts: [], hashtags: [] });
      setSearchResultsOpen(false);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void fetch("/api/search?q=" + encodeURIComponent(query) + "&take=5", { cache: "no-store" })
        .then(async (response) => {
          const json = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(json.error ?? "Search failed.");
          if (!cancelled) {
            setSearchResults({
              users: Array.isArray(json.users) ? json.users.slice(0, 5) : [],
              posts: Array.isArray(json.posts) ? json.posts.slice(0, 5) : [],
              hashtags: Array.isArray(json.hashtags) ? json.hashtags.slice(0, 5) : [],
            });
            setSearchResultsOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setSearchResults({ users: [], posts: [], hashtags: [] });
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    setSearchResultsOpen(false);
    setSearchOpen(false);
    router.push(query ? "/discover?q=" + encodeURIComponent(query) : "/discover");
  }

  function openSearchResult(href: string) {
    setSearchResultsOpen(false);
    setSearchOpen(false);
    setSearch("");
    router.push(href);
  }

  async function logout() {
    if (signingOut || !session?.user) return;
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Could not log out.");
      setAccountMenuOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not log out.");
    } finally {
      setSigningOut(false);
    }
  }

  const profileHref = username ? "/profile/" + encodeURIComponent(username) : "/profile/me";

  return (
    <div className="min-h-screen overflow-x-clip">
      {incomingCall?.caller && session?.user?.id ? (
        <CallPanel
          call={incomingCall}
          currentUserId={session.user.id}
          remoteUser={incomingCall.caller}
          incoming
          onClosed={() => setIncomingCall(null)}
        />
      ) : null}
      <header className="social-topbar sticky top-0 z-[70]">
        <div className="mx-auto flex h-[var(--header-h)] max-w-[1440px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-7">
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
              ref={searchInputRef}
              value={search}
              onFocus={() => { if (search.trim()) setSearchResultsOpen(true); }}
              onChange={(event) => setSearch(event.target.value)}
              className="social-input h-10 w-full pl-10 pr-16 text-sm"
              placeholder="Search people, posts and hashtags…"
              aria-label="Search Socialhub"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-400 lg:block">Ctrl K</kbd>
            {searchResultsOpen ? (
              <div className="absolute inset-x-0 top-12 z-[90] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                {searchLoading ? <p className="px-4 py-3 text-xs font-semibold text-gray-500">Searching…</p> : null}
                {!searchLoading && !searchResults.users.length && !searchResults.posts.length && !searchResults.hashtags.length ? (
                  <p className="px-4 py-4 text-xs font-semibold text-gray-500">No matching people, posts, or hashtags.</p>
                ) : null}
                {!searchLoading && searchResults.users.length ? (
                  <div className="border-b border-gray-100 p-2">
                    <p className="px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] text-gray-400">People</p>
                    {searchResults.users.slice(0, 4).map((user) => (
                      <button key={user.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult("/profile/" + encodeURIComponent(user.username ?? user.id))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-50">
                        {user.image ? <img src={user.image} alt="" className="size-8 rounded-full object-cover"/> : <span className="grid size-8 place-items-center rounded-full bg-[#eeebff] text-[10px] font-black text-[#5a4be8]">{user.name.slice(0,1).toUpperCase()}</span>}
                        <span className="min-w-0"><span className="block truncate text-xs font-black text-gray-900">{user.name}</span><span className="block truncate text-[11px] text-gray-500">@{user.username ?? "member"}</span></span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {!searchLoading && searchResults.hashtags.length ? (
                  <div className="border-b border-gray-100 p-2">
                    <p className="px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] text-gray-400">Hashtags</p>
                    {searchResults.hashtags.slice(0, 4).map((item) => (
                      <button key={item.tag} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult("/discover?q=" + encodeURIComponent(item.tag))} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-gray-50">
                        <span className="grid size-8 place-items-center rounded-lg bg-[#eeebff] text-xs font-black text-[#5a4be8]">#</span>
                        <span className="text-xs font-black text-gray-800">{item.tag}</span><span className="text-[11px] text-gray-500">{item.count} {item.count === 1 ? "post" : "posts"}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {!searchLoading && searchResults.posts.length ? (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-black uppercase tracking-[.14em] text-gray-400">Posts</p>
                    {searchResults.posts.slice(0, 3).map((post) => (
                      <button key={post.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult("/home#post-" + encodeURIComponent(post.id))} className="block w-full rounded-xl px-2 py-2 text-left hover:bg-gray-50">
                        <span className="block truncate text-xs font-black text-gray-800">{post.content ?? "Media post"}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-gray-500">@{post.author.username ?? "member"} · {post.author.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <button type="button" onClick={() => setSearchOpen((value) => !value)} className="social-icon-button bg-gray-50 md:hidden" aria-label="Open search" aria-expanded={searchOpen}>
              <Search size={19} aria-hidden="true" />
            </button>
            <Link href="/notifications" className="social-icon-button relative bg-gray-50" aria-label="Notifications">
              <Bell size={19} aria-hidden="true" />
              {summary.notifications > 0 ? <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-black leading-4 text-white">{Math.min(99, summary.notifications)}</span> : null}
            </Link>
            <div ref={accountMenuRef} className="relative">
              <button type="button" onClick={() => setAccountMenuOpen((value) => !value)} className="rounded-xl p-1 hover:bg-[#eeebff]" aria-label="Open account menu" aria-expanded={accountMenuOpen} aria-haspopup="menu">
                <Avatar id={session?.user?.id} name={session?.user?.name ?? "You"} image={session?.user?.image} size="sm" />
              </button>
              {accountMenuOpen ? (
                <div className="absolute right-0 top-12 z-[95] w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl" role="menu">
                  <Link href={profileHref} onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50" role="menuitem"><User size={16}/>Profile</Link>
                  <Link href="/settings" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50" role="menuitem"><Settings size={16}/>Settings</Link>
                  <ThemeToggle />
                  <div className="my-1 border-t border-gray-100"/>
                  <button type="button" onClick={() => void logout()} disabled={signingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50" role="menuitem"><LogOut size={16}/>{signingOut ? "Logging out…" : "Log out"}</button>
                </div>
              ) : null}
            </div>
            <div className="lg:hidden"><MobileMenu /></div>
          </div>
        </div>
        {searchOpen ? (
          <form onSubmit={submitSearch} className="border-t border-gray-100 bg-white px-3 py-3 md:hidden">
            <div className="relative">
              <input autoFocus value={search} onFocus={() => { if (search.trim()) setSearchResultsOpen(true); }} onChange={(event) => setSearch(event.target.value)} className="social-input w-full px-4 text-sm" placeholder="Search Socialhub…" aria-label="Search Socialhub" />
              {searchResultsOpen ? (
                <div className="absolute left-0 right-0 top-12 z-[90] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  {searchLoading ? <p className="px-4 py-3 text-xs font-semibold text-gray-500">Searching…</p> : null}
                  {!searchLoading && !searchResults.users.length && !searchResults.posts.length && !searchResults.hashtags.length ? <p className="px-4 py-4 text-xs font-semibold text-gray-500">No matches found.</p> : null}
                  {searchResults.users.slice(0, 3).map((user) => <button key={user.id} type="button" onClick={() => openSearchResult("/profile/" + encodeURIComponent(user.username ?? user.id))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"><span className="grid size-8 place-items-center rounded-full bg-[#eeebff] text-[10px] font-black text-[#5a4be8]">{user.name.slice(0,1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-xs font-black">{user.name}</span><span className="block truncate text-[11px] text-gray-500">@{user.username ?? "member"}</span></span></button>)}
                  {searchResults.hashtags.slice(0, 3).map((item) => <button key={item.tag} type="button" onClick={() => openSearchResult("/discover?q=" + encodeURIComponent(item.tag))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"><span className="text-xs font-black text-[#5a4be8]">{item.tag}</span><span className="text-[11px] text-gray-500">{item.count} posts</span></button>)}
                  {searchResults.posts.slice(0, 2).map((post) => <button key={post.id} type="button" onClick={() => openSearchResult("/home#post-" + encodeURIComponent(post.id))} className="block w-full px-4 py-3 text-left hover:bg-gray-50"><span className="block truncate text-xs font-black">{post.content ?? "Media post"}</span><span className="block truncate text-[11px] text-gray-500">@{post.author.username ?? "member"}</span></button>)}
                </div>
              ) : null}
            </div>
          </form>
        ) : null}
      </header>
      <PlatformAnnouncements />

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-3 py-3 sm:gap-6 sm:px-5 sm:py-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-7 lg:py-6">
        <aside className="hidden lg:block">
          <nav className="social-sidebar rounded-3xl p-2" aria-label="Primary navigation">
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

        <main className="min-w-0 mobile-safe-bottom md:scroll-mt-20">{children}</main>
      </div>
      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
