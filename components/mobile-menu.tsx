"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Bookmark, Compass, Home, LogOut, MessageCircle, Settings, Users, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/saved", label: "Saved posts", Icon: Bookmark },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function MobileMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const profileHref = session?.user ? "/profile/me" : "/login";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    try { await authClient.signOut(); }
    finally {
      setOpen(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="social-icon-button min-h-11 min-w-11 md:hidden" aria-label="Open navigation menu" aria-expanded={open} aria-controls="socialhub-mobile-menu">
        <span className="sr-only">Open menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-gray-950/50 backdrop-blur-[2px]" aria-label="Close menu" />
          <aside id="socialhub-mobile-menu" className="absolute right-0 top-0 flex h-dvh w-[min(380px,92vw)] flex-col border-l border-gray-200 bg-white shadow-[-20px_0_70px_rgba(17,24,39,.18)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#6d5dfc]">Socialhub</p><p className="mt-1 text-lg font-black tracking-[-.03em] text-gray-950">Navigation</p></div>
              <button type="button" onClick={() => setOpen(false)} className="social-icon-button min-h-11 min-w-11" aria-label="Close navigation menu"><X size={19}/></button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {session?.user ? <div className="mb-4 rounded-3xl bg-gradient-to-br from-[#f3f0ff] via-white to-[#eef8ff] p-4"><p className="truncate text-sm font-black text-gray-950">{session.user.name}</p><p className="mt-1 truncate text-xs font-medium text-gray-500">{session.user.email}</p><Link href={profileHref} onClick={() => setOpen(false)} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-gray-950 px-3.5 text-xs font-black text-white">Open profile</Link></div> : null}
              <nav className="space-y-1.5" aria-label="Mobile navigation">
                {items.map(({ href, label, Icon }) => {
                  const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
                  return <Link key={href} href={href} onClick={() => setOpen(false)} className={"flex min-h-13 items-center gap-3 rounded-2xl px-4 text-sm font-black transition " + (active ? "bg-[#eeebff] text-[#5a4be8] shadow-sm" : "text-gray-600 hover:bg-gray-50")}><Icon size={19}/><span className="flex-1">{label}</span>{active ? <span className="size-2 rounded-full bg-[#6d5dfc]" aria-hidden="true"/> : null}</Link>;
                })}
                <Link href={profileHref} onClick={() => setOpen(false)} className={"flex min-h-13 items-center gap-3 rounded-2xl px-4 text-sm font-black transition " + (pathname.startsWith("/profile") ? "bg-[#eeebff] text-[#5a4be8] shadow-sm" : "text-gray-600 hover:bg-gray-50")}><Users size={19}/><span className="flex-1">Profile</span>{pathname.startsWith("/profile") ? <span className="size-2 rounded-full bg-[#6d5dfc]" aria-hidden="true"/> : null}</Link>
              </nav>
              <div className="mt-5 rounded-3xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-black text-gray-800">Quick access</p><div className="mt-3 grid grid-cols-2 gap-2"><Link href="/settings#privacy" onClick={() => setOpen(false)} className="rounded-2xl bg-white p-3 text-[11px] font-black text-gray-600 shadow-sm">Privacy</Link><Link href="/settings#security" onClick={() => setOpen(false)} className="rounded-2xl bg-white p-3 text-[11px] font-black text-gray-600 shadow-sm">Security</Link></div></div>
            </div>
            <div className="border-t border-gray-100 p-4">{session?.user ? <button type="button" onClick={() => void signOut()} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-sm font-black text-red-600 hover:bg-red-50"><LogOut size={18}/>Log out</button> : <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#6d5dfc] px-4 text-sm font-black text-white">Sign in</Link>}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
