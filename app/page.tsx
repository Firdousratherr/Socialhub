import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Compass,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

const features = [
  {
    icon: Compass,
    title: "Discover people",
    copy: "Find new profiles, interests, and conversations without losing the people you already follow.",
    tone: "bg-violet-50 text-violet-600",
  },
  {
    icon: Heart,
    title: "Share moments",
    copy: "Post updates, photos, and ideas with clear audience controls for every post.",
    tone: "bg-rose-50 text-rose-500",
  },
  {
    icon: MessageCircle,
    title: "Keep conversations close",
    copy: "Move from a post into private conversations and keep your messages organized.",
    tone: "bg-sky-50 text-sky-600",
  },
  {
    icon: Bell,
    title: "Never miss the important stuff",
    copy: "Likes, comments, follows, friend requests, and messages stay in one activity stream.",
    tone: "bg-amber-50 text-amber-600",
  },
  {
    icon: Bookmark,
    title: "Save what you want",
    copy: "Keep useful posts for later instead of searching through your feed again.",
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: ShieldCheck,
    title: "Built with privacy in mind",
    copy: "Choose public, friends-only, or private posting and use blocking and reporting when needed.",
    tone: "bg-indigo-50 text-indigo-600",
  },
];

const steps = [
  ["01", "Create your profile", "Set your name, username, photo, and a little about yourself."],
  ["02", "Find your people", "Discover profiles, follow people, and build your circle."],
  ["03", "Make it yours", "Share moments, message friends, save posts, and control your privacy."],
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <div className="absolute -inset-8 rounded-[4rem] bg-gradient-to-br from-violet-400/25 via-fuchsia-300/10 to-sky-400/20 blur-3xl" />
      <div className="relative rounded-[2.4rem] border border-white/80 bg-white/85 p-2 shadow-[0_30px_90px_rgba(37,31,84,0.16)] backdrop-blur-xl">
        <div className="overflow-hidden rounded-[2rem] bg-[#f6f6fb]">
          <div className="flex items-center gap-3 border-b border-gray-200/70 bg-white/90 px-4 py-3 sm:px-5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white">
              <Sparkles size={17} />
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
              <div className="h-2.5 w-20 rounded-full bg-gray-200" />
              <div className="h-2.5 w-12 rounded-full bg-gray-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="grid size-8 place-items-center rounded-xl bg-gray-100 text-gray-500"><Search size={15} /></span>
              <span className="grid size-8 place-items-center rounded-xl bg-gray-100 text-gray-500"><Bell size={15} /></span>
            </div>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-[145px_1fr] sm:p-4">
            <aside className="hidden rounded-2xl bg-white p-3 sm:block">
              <div className="flex items-center gap-2 rounded-xl bg-[#eeebff] p-2 text-xs font-black text-[#5a4be8]">
                <Compass size={15} /> Home
              </div>
              {[
                [Users, "Friends"],
                [MessageCircle, "Messages"],
                [Bookmark, "Saved"],
                [UserPlus, "Discover"],
              ].map(([Icon, label]) => (
                <div key={String(label)} className="mt-1 flex items-center gap-2 rounded-xl p-2 text-[11px] font-bold text-gray-500">
                  <Icon size={14} /> {String(label)}
                </div>
              ))}
            </aside>

            <div className="space-y-3">
              <div className="flex gap-2 overflow-hidden">
                {["Your story", "Aisha", "Nora", "Arjun"].map((label, index) => (
                  <div key={label} className="min-w-[78px] rounded-2xl bg-white p-2.5">
                    <div className={`mx-auto size-9 rounded-full bg-gradient-to-br ${index === 0 ? "from-violet-500 to-sky-400" : index === 1 ? "from-pink-400 to-orange-400" : index === 2 ? "from-emerald-400 to-cyan-400" : "from-amber-400 to-rose-400"}`} />
                    <p className="mt-2 truncate text-center text-[9px] font-bold text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              <article className="overflow-hidden rounded-2xl bg-white">
                <div className="flex items-center gap-2 p-3">
                  <div className="size-9 rounded-full bg-gradient-to-br from-violet-500 to-sky-400" />
                  <div className="flex-1">
                    <div className="h-2.5 w-24 rounded-full bg-gray-200" />
                    <div className="mt-1.5 h-2 w-16 rounded-full bg-gray-100" />
                  </div>
                  <div className="size-7 rounded-lg bg-gray-100" />
                </div>
                <div className="mx-3 rounded-xl bg-gradient-to-br from-[#eceaff] via-[#f9efff] to-[#e2f7ff] p-4">
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#6d5dfc]">Today</p>
                  <p className="mt-1.5 max-w-sm text-xl font-black leading-tight tracking-[-.035em] text-gray-950 sm:text-2xl">
                    Make room for the people and moments that matter.
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="aspect-[1.25] rounded-xl bg-violet-300/55" />
                    <div className="aspect-[1.25] rounded-xl bg-sky-300/55" />
                    <div className="aspect-[1.25] rounded-xl bg-pink-300/55" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-3 text-gray-400">
                  <div className="flex gap-3">
                    <Heart size={15} />
                    <MessageCircle size={15} />
                    <Bookmark size={15} />
                  </div>
                  <ImageIcon size={15} />
                </div>
              </article>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ["People", Users],
                  ["Messages", MessageCircle],
                  ["Privacy", ShieldCheck],
                ].map(([label, Icon]) => (
                  <div key={String(label)} className="rounded-2xl bg-white p-3">
                    <Icon size={15} className="text-[#6d5dfc]" />
                    <p className="mt-2 text-[9px] font-black text-gray-700">{String(label)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/home");

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute left-[-12rem] top-[-10rem] size-[28rem] rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-12rem] top-[8rem] size-[28rem] rounded-full bg-sky-300/20 blur-3xl" />

        <div className="relative mx-auto flex min-h-[720px] w-full max-w-7xl flex-col px-5 pb-14 pt-5 sm:px-8 lg:min-h-[820px] lg:px-10 lg:pt-7">
          <header className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl sm:px-4">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Socialhub home">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#6d5dfc] text-white shadow-lg shadow-[#6d5dfc]/25">
                <Sparkles size={19} />
              </span>
              <span className="text-lg font-black tracking-[-0.03em]">Socialhub</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
              <a href="#features" className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-950">Features</a>
              <a href="#how-it-works" className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-950">How it works</a>
              <a href="#privacy" className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-950">Privacy</a>
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link href="/login" className="rounded-xl px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-white hover:text-gray-950 sm:px-4 sm:text-sm">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-xl bg-gray-950 px-3.5 py-2.5 text-xs font-black text-white shadow-lg shadow-gray-950/10 transition hover:-translate-y-0.5 hover:bg-gray-800 sm:px-4 sm:text-sm">
                Create account
              </Link>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:py-20">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3.5 py-2 text-[11px] font-black text-[#5a4be8] shadow-sm backdrop-blur">
                <span className="size-1.5 rounded-full bg-[#6d5dfc]" />
                Connect. Share. Belong.
              </div>

              <h1 className="text-5xl font-black leading-[.94] tracking-[-.065em] text-gray-950 sm:text-6xl lg:text-[5.25rem]">
                Social, without
                <span className="block bg-gradient-to-r from-[#6d5dfc] via-[#9b75ff] to-[#36b8ff] bg-clip-text text-transparent">
                  the noise.
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
                Share the moments that matter, keep conversations close, discover new people,
                and control who gets to see your posts.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-gray-950 px-6 text-sm font-black text-white shadow-xl shadow-gray-950/15 transition hover:-translate-y-0.5 hover:bg-gray-800">
                  Create your account
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href="#features" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-gray-200 bg-white/80 px-6 text-sm font-black text-gray-700 transition hover:bg-white">
                  Explore features
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-gray-500">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Privacy controls</span>
                <span className="inline-flex items-center gap-1.5"><ImageIcon size={14} className="text-violet-500" /> Photo sharing</span>
                <span className="inline-flex items-center gap-1.5"><MessageCircle size={14} className="text-sky-500" /> Private messages</span>
              </div>
            </div>

            <ProductPreview />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["People", "Profiles & connections"],
              ["Moments", "Posts & stories"],
              ["Conversations", "Messages & replies"],
              ["Control", "Privacy & safety"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-white/90 bg-white/70 p-4 shadow-sm backdrop-blur">
                <p className="text-sm font-black text-gray-950">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-gray-500">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-gray-200/70 bg-white/65">
        <div className="mx-auto max-w-7xl px-5 py-18 sm:px-8 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#6d5dfc]">Made for everyday social life</p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-[-.05em] text-gray-950 sm:text-5xl">
              Everything important. Nothing unnecessarily complicated.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
              Socialhub keeps the familiar parts of a social network while giving you clearer controls and a calmer interface.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, copy, tone }) => (
              <article key={title} className="group rounded-3xl border border-gray-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(20,24,40,.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(20,24,40,.08)]">
                <span className={`grid size-12 place-items-center rounded-2xl ${tone}`}>
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-lg font-black tracking-[-.025em] text-gray-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-18 sm:px-8 lg:px-10 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#6d5dfc]">A simple start</p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-[-.05em] text-gray-950 sm:text-5xl">
              Go from signup to your first connection in minutes.
            </h2>
            <p className="mt-5 text-sm leading-6 text-gray-500">
              Start with the basics and shape your space as you go. Your profile and privacy controls stay in your hands.
            </p>
          </div>

          <div className="grid gap-3">
            {steps.map(([number, title, copy]) => (
              <article key={number} className="flex gap-4 rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm sm:gap-6 sm:p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eeebff] text-xs font-black text-[#5a4be8]">{number}</span>
                <div>
                  <h3 className="text-base font-black text-gray-950 sm:text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-gray-500">{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="border-y border-gray-200/70 bg-gradient-to-br from-[#171426] via-[#262052] to-[#172d46] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-18 sm:px-8 lg:grid-cols-[1fr_.8fr] lg:items-center lg:px-10 lg:py-24">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-white/10">
              <ShieldCheck size={21} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-white/50">Privacy & safety</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-black leading-tight tracking-[-.05em] sm:text-5xl">
              Your audience should be a choice, not a surprise.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              Socialhub supports public, friends-only, and private posts, plus reporting and blocking tools for everyday account safety.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Public", "Share with everyone"],
              ["Friends", "Share with accepted friends"],
              ["Private", "Keep it to yourself"],
              ["Safety", "Report or block accounts"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/7 p-4">
                <p className="text-sm font-black">{title}</p>
                <p className="mt-1 text-[11px] leading-5 text-white/50">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-18 text-center sm:px-8 lg:px-10 lg:py-24">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">
          <Sparkles size={23} />
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[#6d5dfc]">Ready when you are</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-black leading-tight tracking-[-.05em] text-gray-950 sm:text-5xl">
          Build your corner of Socialhub.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-500">
          Create an account, find your people, and start sharing.
        </p>
        <Link href="/signup" className="mt-8 inline-flex min-h-13 items-center gap-2 rounded-2xl bg-gray-950 px-6 text-sm font-black text-white shadow-xl shadow-gray-950/10 transition hover:-translate-y-0.5 hover:bg-gray-800">
          Create your account <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="border-t border-gray-200/70 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span className="font-black text-gray-800">Socialhub</span>
          <span>Connect. Share. Belong.</span>
        </div>
      </footer>
    </main>
  );
}
