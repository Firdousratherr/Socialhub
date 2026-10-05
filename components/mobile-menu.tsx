"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [signingOut, setSigningOut] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileHref = session?.user ? "/profile/me" : "/login";

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = document.getElementById("socialhub-mobile-menu");
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const panel = document.getElementById("socialhub-mobile-menu");
      if (panel && !panel.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function closeMenu() {
    setOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message || "Could not log out.");
      }
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not log out.");
    } finally {
      setSigningOut(false);
    }
  }

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="mobile-menu-layer md:hidden" aria-label="Navigation menu">
            <button
              type="button"
              onClick={closeMenu}
              className="mobile-menu-scrim"
              aria-label="Close navigation menu"
            />
            <aside
              id="socialhub-mobile-menu"
              className="mobile-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="socialhub-mobile-menu-title"
            >
              <div className="mobile-menu-header">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#6d5dfc]">
                    Socialhub
                  </p>
                  <h2 id="socialhub-mobile-menu-title" className="mt-1 text-lg font-black tracking-[-.03em] text-[var(--foreground)]">
                    Navigation
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeMenu}
                  className="social-icon-button"
                  aria-label="Close navigation menu"
                >
                  <X size={19} aria-hidden="true" />
                </button>
              </div>

              <div className="mobile-menu-scroll scrollbar-none">
                {session?.user ? (
                  <div className="mobile-menu-account">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--foreground)]">
                        {session.user.name}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-[var(--muted)]">
                        {session.user.email}
                      </p>
                    </div>
                    <Link
                      href={profileHref}
                      onClick={closeMenu}
                      className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-gray-950 px-3.5 text-xs font-black text-white"
                    >
                      Open profile
                    </Link>
                  </div>
                ) : null}

                <nav className="space-y-1.5" aria-label="Mobile navigation">
                  {items.map(({ href, label, Icon }) => {
                    const active =
                      pathname === href ||
                      (href !== "/home" && pathname.startsWith(href + "/"));

                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={closeMenu}
                        aria-current={active ? "page" : undefined}
                        className={"mobile-menu-link " + (active ? "is-active" : "")}
                      >
                        <Icon size={19} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                        <span className="min-w-0 flex-1">{label}</span>
                        {active ? <span className="size-2 rounded-full bg-[#6d5dfc]" aria-hidden="true" /> : null}
                      </Link>
                    );
                  })}
                  <Link
                    href={profileHref}
                    onClick={closeMenu}
                    aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                    className={"mobile-menu-link " + (pathname.startsWith("/profile") ? "is-active" : "")}
                  >
                    <Users size={19} strokeWidth={pathname.startsWith("/profile") ? 2.5 : 2} aria-hidden="true" />
                    <span className="min-w-0 flex-1">Profile</span>
                    {pathname.startsWith("/profile") ? <span className="size-2 rounded-full bg-[#6d5dfc]" aria-hidden="true" /> : null}
                  </Link>
                </nav>

                <div className="mobile-menu-quick">
                  <p className="text-xs font-black text-[var(--foreground)]">Quick access</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href="/settings#privacy" onClick={closeMenu} className="mobile-menu-quick-link">
                      Privacy
                    </Link>
                    <Link href="/settings#security" onClick={closeMenu} className="mobile-menu-quick-link">
                      Security
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mobile-menu-footer">
                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    disabled={signingOut}
                    className="mobile-menu-logout"
                    aria-label="Log out of Socialhub"
                  >
                    <LogOut size={18} aria-hidden="true" />
                    <span>{signingOut ? "Logging out…" : "Log out"}</span>
                  </button>
                ) : (
                  <Link href="/login" onClick={closeMenu} className="mobile-menu-signin">
                    Sign in
                  </Link>
                )}
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="social-icon-button md:hidden"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="socialhub-mobile-menu"
      >
        <span className="sr-only">Open menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {dialog}
    </>
  );
}
