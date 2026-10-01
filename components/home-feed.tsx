"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  Bell,
  Bookmark,
  Compass,
  Heart,
  Home,
  Image as ImageIcon,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  ThumbsUp,
  UserPlus,
  Users,
} from "lucide-react";

type Post = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  timestamp: string;
  copy: string;
  accent: string;
  likes: number;
  comments: number;
  shares: number;
};

const posts: Post[] = [
  {
    id: "sample-1",
    name: "Maya Chen",
    handle: "@mayachen",
    initials: "MC",
    timestamp: "18 min",
    copy: "A little progress is still progress. Today I finally shipped the thing I had been putting off. ✨",
    accent: "from-violet-500 via-fuchsia-400 to-amber-300",
    likes: 248,
    comments: 34,
    shares: 12,
  },
  {
    id: "sample-2",
    name: "Arjun Mehta",
    handle: "@arjunm",
    initials: "AM",
    timestamp: "1 hr",
    copy: "Weekend walks, good coffee, and a camera roll full of tiny moments worth keeping.",
    accent: "from-sky-500 via-cyan-400 to-emerald-300",
    likes: 176,
    comments: 21,
    shares: 8,
  },
];

const navItems = [
  { label: "Home", icon: Home, active: true, href: "/home" },
  { label: "Discover", icon: Compass, href: "/discover" },
  { label: "Friends", icon: Users, href: "/friends" },
  { label: "Messages", icon: MessageCircle, href: "/messages" },
  { label: "Notifications", icon: Bell, href: "/notifications", badge: 3 },
];

function Avatar({
  initials,
  large = false,
  accent = "from-violet-500 to-sky-400",
}: {
  initials: string;
  large?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={[
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br text-white shadow-sm",
        accent,
        large ? "size-12 text-sm font-black" : "size-9 text-xs font-extrabold",
      ].join(" ")}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const { data: session } = authClient.useSession();
  const [likeCount, setLikeCount] = useState(post.likes);

  async function toggleLike() {
    if (!session?.user || post.id.startsWith("sample-")) {
      setLiked((value) => !value);
      setLikeCount((value) => value + (liked ? -1 : 1));
      return;
    }

    const response = await fetch(\`/api/posts/\${post.id}/like\`, {
      method: liked ? "DELETE" : "POST",
    });

    if (response.ok) {
      const json = await response.json();
      setLiked(Boolean(json.liked));
      setLikeCount(Number(json.count ?? likeCount));
    }
  }

  return (
    <article className="social-card overflow-hidden rounded-3xl">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className={\`grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br \${post.accent} text-xs font-extrabold text-white shadow-sm\`} aria-hidden="true">{post.initials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5"><p className="truncate text-sm font-extrabold text-gray-950">{post.name}</p><span className="text-gray-300">·</span><span className="text-xs font-medium text-gray-400">{post.timestamp}</span></div>
            <p className="text-xs font-medium text-gray-400">{post.handle}</p>
          </div>
          <button className="social-icon-button" aria-label="More post options"><MoreHorizontal size={19}/></button>
        </div>

        <p className="mt-4 text-[15px] leading-6 text-gray-700">{post.copy}</p>

        <div className={\`relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br p-6 sm:p-8 \${post.accent}\`}>
          <div className="absolute -right-12 -top-12 size-36 rounded-full bg-white/25 blur-2xl" />
          <div className="absolute -bottom-12 -left-8 size-32 rounded-full bg-white/20 blur-2xl" />
          <div className="relative max-w-sm"><div className="mb-6 inline-flex rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90">Socialhub moment</div><p className="text-2xl font-black leading-tight tracking-[-0.04em] text-white sm:text-3xl">Keep the small moments. They become the big story.</p></div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-gray-400"><span>{likeCount.toLocaleString()} reactions</span><span>{post.comments} comments · {post.shares} shares</span></div>

        <div className="mt-4 grid grid-cols-4 border-t border-gray-100 pt-3">
          <button onClick={toggleLike} className={\`flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition \${liked ? "bg-rose-50 text-rose-500" : "text-gray-500 hover:bg-gray-50"}\`} aria-pressed={liked}><Heart size={17} fill={liked ? "currentColor" : "none"}/>Like</button>
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-500 transition hover:bg-gray-50"><MessageCircle size={17}/>Comment</button>
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-500 transition hover:bg-gray-50"><Share2 size={17}/>Share</button>
          <button onClick={()=>setSaved((value)=>!value)} className={\`flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition \${saved ? "bg-violet-50 text-violet-600" : "text-gray-500 hover:bg-gray-50"}\`} aria-pressed={saved}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/>Save</button>
        </div>
      </div>
    </article>
  );
}
export default function HomeFeed() {
  const { data: session } = authClient.useSession();
  const [feedPosts, setFeedPosts] = useState<Post[]>(posts);
  const [newPost, setNewPost] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [feedError, setFeedError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadPosts() {
      try {
        const response = await fetch("/api/posts?take=30", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) return;
        const mapped = (json.posts ?? []).map((item: { id: string; content: string | null; createdAt: string; author: { name: string; username: string | null }; _count: { likes: number; comments: number } }, index: number) => ({
          id: item.id,
          name: item.author.name,
          handle: \`@\${item.author.username ?? "member"}\`,
          initials: item.author.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase(),
          timestamp: new Date(item.createdAt).toLocaleString(),
          copy: item.content ?? "Shared a new moment.",
          accent: ["from-violet-500 via-fuchsia-400 to-amber-300","from-sky-500 via-cyan-400 to-emerald-300","from-emerald-400 via-cyan-400 to-sky-400","from-amber-400 via-rose-400 to-fuchsia-400"][index % 4],
          likes: item._count.likes,
          comments: item._count.comments,
          shares: 0,
        }));
        if (!cancelled && mapped.length > 0) setFeedPosts(mapped);
      } catch {
        // Keep the polished local feed if the public API is unavailable.
      }
    }
    void loadPosts();
    return () => { cancelled = true; };
  }, []);

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user || !newPost.trim() || publishing) return;
    setPublishing(true);
    setFeedError("");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPost.trim(), visibility: "PUBLIC" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not publish post.");

      const item = json.post;
      const created: Post = {
        id: item.id,
        name: item.author.name,
        handle: \`@\${item.author.username ?? "member"}\`,
        initials: item.author.name.split(" ").map((part: string) => part[0]).join("").slice(0,2).toUpperCase(),
        timestamp: "Just now",
        copy: item.content ?? "",
        accent: "from-violet-500 via-fuchsia-400 to-sky-400",
        likes: 0,
        comments: 0,
        shares: 0,
      };
      setFeedPosts((current) => [created, ...current]);
      setNewPost("");
    } catch (publishError) {
      setFeedError(publishError instanceof Error ? publishError.message : "Could not publish post.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-transparent pb-20 md:pb-6">
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Socialhub"><span className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/20"><Sparkles size={17}/></span><span className="hidden text-base font-black tracking-[-0.03em] text-gray-950 sm:block">Socialhub</span></Link>
          <label className="relative mx-auto hidden max-w-md flex-1 md:block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/><input className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-gray-400 focus:border-[#bdb6ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Search people, posts, topics…" aria-label="Search"/></label>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="social-icon-button md:hidden" aria-label="Search"><Search size={19}/></button>
            <Link href="/messages" className="social-icon-button" aria-label="Messages"><MessageCircle size={19}/></Link>
            <Link href="/notifications" className="social-icon-button relative" aria-label="Notifications"><Bell size={19}/><span className="absolute right-2 top-2 size-2 rounded-full bg-[#6d5dfc] ring-2 ring-white"/></Link>
            <Link href="/profile/firdous"><Avatar initials="FR"/></Link>
            <button className="social-icon-button md:hidden" aria-label="Menu"><Menu size={19}/></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,650px)_300px] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="mb-4 rounded-3xl border border-white/70 bg-white/70 p-2.5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3 rounded-2xl bg-[#f5f2ff] p-3"><Link href="/profile/firdous"><Avatar initials="FR" large /></Link><div className="min-w-0"><p className="truncate text-sm font-extrabold">Your profile</p><p className="truncate text-xs font-medium text-gray-400">@firdous</p></div></div>
              <nav className="mt-2 space-y-1" aria-label="Primary navigation">
                {navItems.map(({ label, icon: Icon, active, badge, href }) => <Link key={label} href={href} data-active={active} className="social-nav-link justify-between"><span className="flex items-center gap-3"><Icon size={18} strokeWidth={active ? 2.4 : 2}/><span className="text-sm">{label}</span></span>{badge ? <span className="grid size-5 place-items-center rounded-full bg-[#6d5dfc] text-[10px] font-black text-white">{badge}</span> : null}</Link>)}
              </nav>
              <div className="my-3 border-t border-gray-100"/>
              <Link href="/settings" className="social-nav-link"><Settings size={18}/><span className="text-sm font-semibold">Settings</span></Link>
            </div>
            <p className="px-3 text-[11px] font-medium leading-5 text-gray-400">Built for thoughtful sharing, meaningful connections, and everyday moments.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">Home</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-gray-950">Your feed</h1></div><button className="social-icon-button bg-white/70" aria-label="Customize feed"><Sparkles size={17}/></button></div>
          {feedError ? <div role="alert" className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{feedError}</div> : null}
          <form onSubmit={publishPost} className="social-card mb-5 rounded-3xl p-4">
            <div className="flex gap-3"><Avatar initials="FR" accent="from-gray-800 to-gray-500"/><div className="min-w-0 flex-1"><textarea value={newPost} onChange={(event)=>setNewPost(event.target.value)} disabled={!session?.user || publishing} rows={2} className="w-full resize-none rounded-2xl bg-gray-50 px-4 py-3 text-sm font-medium outline-none placeholder:text-gray-400 focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10 disabled:cursor-not-allowed disabled:opacity-70" placeholder={session?.user ? "What’s happening, Firdous?" : "Sign in to share a post…"}/></div></div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <div className="flex gap-2"><button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-gray-500 hover:bg-gray-50"><ImageIcon size={17} className="text-emerald-500"/>Photo</button><button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-gray-500 hover:bg-gray-50"><Sparkles size={17} className="text-violet-500"/>Feeling</button></div>
              {session?.user ? <button type="submit" disabled={!newPost.trim() || publishing} className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{publishing ? "Posting…" : "Post"}</button> : <Link href="/login" className="rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-black text-white">Sign in</Link>}
            </div>
          </form>
          <div className="space-y-5">{feedPosts.map((post)=><PostCard key={post.id} post={post}/>)}</div>
        </section>
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-5">
            <section className="social-card rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black tracking-[-0.02em]">Stories</h2>
                <button className="text-xs font-bold text-[#6d5dfc]">See all</button>
              </div>
              <div className="mt-4 flex gap-3 overflow-hidden">
                <div className="min-w-16">
                  <div className="grid size-16 place-items-center rounded-2xl border-2 border-dashed border-[#c9c4ff] bg-[#f5f2ff] text-[#6d5dfc]">
                    <Plus size={19} />
                  </div>
                  <p className="mt-2 truncate text-[11px] font-bold text-gray-500">Your story</p>
                </div>
                {[
                  ["AK", "Aarav", "from-emerald-400 to-sky-500"],
                  ["SM", "Sara", "from-pink-400 to-violet-500"],
                  ["JT", "Jai", "from-amber-400 to-orange-500"],
                ].map(([initials, name, accent]) => (
                  <div className="min-w-16" key={name}>
                    <div className="rounded-[1.15rem] bg-gradient-to-br p-[2px] from-[#6d5dfc] via-[#d957ff] to-[#ffb347]">
                      <div className="rounded-[1rem] bg-white p-[2px]">
                        <Avatar initials={initials} accent={accent} large />
                      </div>
                    </div>
                    <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">{name}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="social-card rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black tracking-[-0.02em]">People to follow</h2>
                <button className="text-xs font-bold text-[#6d5dfc]">View all</button>
              </div>
              <div className="mt-4 space-y-4">
                {[
                  ["NP", "Nora Patel", "@norapatel", "from-fuchsia-500 to-orange-400"],
                  ["DK", "Dev Kapoor", "@devk", "from-sky-500 to-indigo-500"],
                  ["ZS", "Zoya Shah", "@zoyas", "from-amber-400 to-rose-500"],
                ].map(([initials, name, handle, accent]) => (
                  <div key={handle} className="flex items-center gap-3">
                    <Avatar initials={initials} accent={accent} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-gray-900">{name}</p>
                      <p className="truncate text-[11px] font-medium text-gray-400">{handle}</p>
                    </div>
                    <button
                      className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white transition hover:bg-gray-800"
                      aria-label={"Follow " + name}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-gradient-to-br from-[#171426] to-[#2a2450] p-5 text-white shadow-xl shadow-violet-950/10">
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/10">
                <Sparkles size={17} />
              </div>
              <h2 className="mt-4 text-base font-black tracking-[-0.02em]">Make your profile yours.</h2>
              <p className="mt-2 text-xs leading-5 text-white/65">
                Add a bio, photo, and a few details so people can recognize you at a glance.
              </p>
              <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-black text-gray-950 transition hover:bg-gray-100">
                Edit profile
                <ArrowRightIcon />
              </button>
            </section>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-gray-200/80 bg-white/95 p-1.5 shadow-2xl shadow-gray-950/10 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {[
          [Home, "Home", true],
          [Compass, "Discover", false],
          [Plus, "Create", false],
          [Bell, "Alerts", false],
          [Users, "Profile", false],
        ].map(([Icon, label, active]) => (
          <button
            key={String(label)}
            className={[
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition",
              active ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500",
            ].join(" ")}
          >
            <Icon size={18} strokeWidth={active ? 2.5 : 2} />
            {String(label)}
          </button>
        ))}
      </nav>
    </main>
  );
}

function ArrowRightIcon() {
  return <Send size={15} className="-rotate-45" />;
}
