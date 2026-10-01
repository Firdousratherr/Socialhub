import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Compass,
  Home,
  LogOut,
  MessageCircle,
  Settings,
  Users,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function MobileMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const profileHref = session?.user ? "/profile/me" : "/login";

  async function signOut() {
    await authClient.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="social-icon-button"
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <span className="sr-only">Open menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            onClick={close}
            className="absolute inset-0 bg-gray-950/45"
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 right-0 z-10 flex w-[360px] max-w-[88vw] flex-col overflow-y-auto border-l border-gray-200 bg-white p-5 opacity-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d5dfc]">
                  Socialhub
                </p>
                <p className="mt-1 text-lg font-black tracking-[-0.03em]">Navigation</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="social-icon-button"
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-6 space-y-1.5" aria-label="Mobile navigation">
              {items.map(({ href, label, Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={
                      "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-black transition " +
                      (active
                        ? "bg-[#eeebff] text-[#5a4be8]"
                        : "text-gray-600 hover:bg-gray-50")
                    }
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
              <Link
                href={profileHref}
                onClick={close}
                className={
                  "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-black transition " +
                  (pathname.startsWith("/profile")
                    ? "bg-[#eeebff] text-[#5a4be8]"
                    : "text-gray-600 hover:bg-gray-50")
                }
              >
                <Users size={18} />
                Profile
              </Link>
            </nav>

            <div className="mt-auto border-t border-gray-100 pt-4">
              {session?.user ? (
                <div className="mb-3 rounded-2xl bg-gray-50 p-3">
                  <p className="truncate text-sm font-black text-gray-900">{session.user.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-400">{session.user.email}</p>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={close}
                  className="mb-3 block rounded-2xl bg-[#6d5dfc] px-4 py-3 text-center text-sm font-black text-white"
                >
                  Sign in
                </Link>
              )}

              {session?.user ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-sm font-black text-red-600 hover:bg-red-50"
                >
                  <LogOut size={18} />
                  Log out
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
