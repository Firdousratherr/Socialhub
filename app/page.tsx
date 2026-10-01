import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ArrowRight, Compass, Heart, MessageCircle, Sparkles, Users } from "lucide-react";

const features = [
  {
    icon: Heart,
    title: "Share what matters",
    copy: "Post moments, ideas, photos, and updates in a feed designed around people—not clutter.",
  },
  {
    icon: Users,
    title: "Build your circle",
    copy: "Find friends, follow interesting people, and grow a community around shared interests.",
  },
  {
    icon: MessageCircle,
    title: "Stay in the loop",
    copy: "Keep conversations, notifications, and new connections in one calm, organized place.",
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/home");

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Socialhub home">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#6d5dfc] text-white shadow-lg shadow-[#6d5dfc]/25">
              <Sparkles size={19} />
            </span>
            <span className="text-lg font-black tracking-[-0.03em]">Socialhub</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-white hover:text-gray-950"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Create account
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3.5 py-2 text-xs font-bold text-gray-600 shadow-sm backdrop-blur">
              <span className="size-1.5 rounded-full bg-[#6d5dfc]" />
              A social space built for people
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-gray-950 sm:text-6xl lg:text-7xl">
              Your people.
              <span className="block bg-gradient-to-r from-[#6d5dfc] via-[#8b74ff] to-[#36b8ff] bg-clip-text text-transparent">
                Your moments.
              </span>
              Your space.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
              Socialhub brings your feed, conversations, connections, and discoveries into
              one clean social experience that works beautifully on every screen.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 text-sm font-bold text-white shadow-xl shadow-gray-950/10 transition hover:-translate-y-0.5 hover:bg-gray-800"
              >
                Create your account
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#features"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white/80 px-5 text-sm font-bold text-gray-700 transition hover:bg-white"
              >
                See the idea
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-[#6d5dfc]/15 via-transparent to-[#36b8ff]/15 blur-2xl" />
            <div className="social-card relative rounded-[2rem] p-3">
              <div className="rounded-[1.5rem] bg-[#f7f7fb] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-[#6d5dfc] to-[#36b8ff]" />
                    <div>
                      <div className="h-3 w-28 rounded-full bg-gray-900/10" />
                      <div className="mt-2 h-2.5 w-20 rounded-full bg-gray-900/5" />
                    </div>
                  </div>
                  <div className="size-9 rounded-xl bg-white" />
                </div>

                <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#eceaff] via-[#f5efff] to-[#dff6ff] p-5">
                  <div className="max-w-xs">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6d5dfc]">
                      Today
                    </p>
                    <p className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-gray-950">
                      Make room for the people and moments that matter.
                    </p>
                  </div>
                  <div className="mt-7 grid grid-cols-4 gap-2">
                    {["#6d5dfc", "#36b8ff", "#f59e0b", "#ec4899"].map((color, index) => (
                      <div
                        key={color}
                        className="aspect-square rounded-xl"
                        style={{ background: color, opacity: 0.18 + index * 0.05 }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <div className="h-9 flex-1 rounded-xl bg-white" />
                  <div className="h-9 w-16 rounded-xl bg-[#6d5dfc]/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-gray-200/70 bg-white/55">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="max-w-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">
              Designed for everyday use
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-gray-950 sm:text-4xl">
              Everything you need to stay connected.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="social-card rounded-3xl p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">
                  <Icon size={19} />
                </span>
                <h3 className="mt-5 text-lg font-black tracking-[-0.02em] text-gray-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
