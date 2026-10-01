"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, AtSign, BarChart3, Bell, Bookmark, Camera, Check,
  ChevronRight, CircleHelp, Compass, Globe2, Heart, Image as ImageIcon,
  KeyRound, Lock, LogIn, Mail, MessageCircle, MoreHorizontal, Pencil, Plus,
  Search, Send, Settings, Shield, Sparkles, Trash2, UserPlus, Users, X
} from "lucide-react";

type Screen = { kind: string; username?: string; section?: string };

const colors = [
  "from-violet-500 to-sky-400",
  "from-fuchsia-500 to-orange-400",
  "from-emerald-400 to-cyan-500",
  "from-amber-400 to-rose-500",
];

const people = [
  ["NP", "Nora Patel", "@norapatel", "12 mutuals"],
  ["DK", "Dev Kapoor", "@devk", "8 mutuals"],
  ["ZS", "Zoya Shah", "@zoyas", "5 mutuals"],
  ["AK", "Aarav Khan", "@aaravk", "21 mutuals"],
];

function Avatar({ initials, color = colors[0], size = "md" }: { initials: string; color?: string; size?: "sm"|"md"|"lg"|"xl" }) {
  const sizes = { sm: "size-8 text-[10px]", md: "size-10 text-xs", lg: "size-14 text-sm", xl: "size-24 text-2xl" };
  return <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${color} ${sizes[size]} font-black text-white shadow-sm`}>{initials}</div>;
}

function Page({ eyebrow, title, subtitle, action, children }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <main className="min-h-screen pb-8"><div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mb-7 flex items-end justify-between gap-4"><div>{eyebrow && <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">{eyebrow}</p>}<h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-gray-950 sm:text-4xl">{title}</h1>{subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{subtitle}</p>}</div>{action}</div>
    {children}
  </div></main>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`social-card rounded-3xl p-5 ${className}`}>{children}</section>;
}

function Auth({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = signup
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
            callbackURL: "/home",
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
            callbackURL: "/home",
          });

      if (result.error) {
        setError(result.error.message || "Authentication failed. Please try again.");
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("We could not reach the authentication service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
        <section className="hidden bg-[radial-gradient(circle_at_top,#7d70ff,transparent_55%),linear-gradient(145deg,#171426,#30275d)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-white/10"><Sparkles size={18}/></span>
            <span className="font-black">Socialhub</span>
          </Link>
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-white/50">Connect. Share. Belong.</p>
            <h1 className="mt-5 max-w-md text-5xl font-black leading-[.96] tracking-[-.055em]">A social space that feels like yours.</h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/65">Keep your people close, share the moments that matter, and discover conversations worth having.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[["12.4k","members"],["48k","posts"],["9.8k","daily chats"]].map(x=>
              <div key={x[1]} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <p className="font-black">{x[0]}</p>
                <p className="text-[10px] text-white/50">{x[1]}</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <Link href="/" className="flex items-center gap-2 font-black">
                <span className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white"><Sparkles size={17}/></span>
                Socialhub
              </Link>
              <Link href="/home" className="text-xs font-bold text-gray-500">Preview</Link>
            </div>

            <p className="text-xs font-black uppercase tracking-[.16em] text-[#6d5dfc]">{signup ? "Create your account" : "Welcome back"}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">{signup ? "Join Socialhub today." : "Sign in to Socialhub."}</h2>
            <p className="mt-2 text-sm text-gray-500">{signup ? "Build your profile and start finding your people." : "Pick up where you left off."}</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {signup && (
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-600">Full name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
                    placeholder="Firdous Rather"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-600">Email</span>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
                    placeholder="you@example.com"
                  />
                </div>
              </label>

              {signup && (
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-600">Username</span>
                  <div className="relative">
                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                    <input
                      value={email.split("@")[0]}
                      readOnly
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-gray-500 outline-none"
                      aria-label="Username preview"
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-400">We’ll start with your email name; you can change it from your profile.</p>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-600">Password</span>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={signup ? "new-password" : "current-password"}
                    minLength={8}
                    required
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-20 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-gray-500">
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {!signup && (
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-[#6d5dfc]"/>Remember me
                  </label>
                  <button type="button" className="font-black text-[#5a4be8]">Forgot password?</button>
                </div>
              )}

              {error ? (
                <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn size={17}/>
                {loading ? "Please wait…" : signup ? "Create account" : "Sign in"}
              </button>

              <button
                type="button"
                disabled
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 text-sm font-bold text-gray-400 disabled:cursor-not-allowed"
                title="Google sign-in will be enabled after provider credentials are configured."
              >
                <Globe2 size={17}/>
                Continue with Google
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-gray-500">
              {signup ? (
                <>Already have an account? <Link href="/login" className="font-black text-[#5a4be8]">Sign in</Link></>
              ) : (
                <>New to Socialhub? <Link href="/signup" className="font-black text-[#5a4be8]">Create an account</Link></>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
function Profile({ username = "firdous" }: { username?: string }) {
  const [editing,setEditing]=useState(false); const [following,setFollowing]=useState(false);
  return <Page eyebrow="Profile" title={`@${username}`} action={<button onClick={()=>setEditing(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white"><Pencil size={15}/>{editing?"Done":"Edit profile"}</button>}>
    <div className="overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)]">
      <div className="relative h-48 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.24),transparent_22%),linear-gradient(135deg,#5a4be8,#2e9fe9_55%,#51d3b4)]"><button className="absolute right-4 top-4 grid size-10 place-items-center rounded-xl bg-black/20 text-white"><Camera size={17}/></button></div>
      <div className="relative px-5 pb-6 sm:px-8"><div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end"><div className="rounded-full border-4 border-white"><Avatar initials="FR" size="xl"/></div><div className="flex-1 sm:pb-2"><h2 className="text-2xl font-black tracking-[-.04em]">Firdous Rather</h2><p className="text-sm font-semibold text-gray-400">@{username} · Jammu & Kashmir</p></div><button onClick={()=>setFollowing(v=>!v)} className={following?"h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700":"h-10 rounded-xl bg-[#6d5dfc] px-4 text-xs font-black text-white"}>{following?"Following":"Follow"}</button></div>
        {editing ? <div className="mt-6 grid gap-4 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] p-4 sm:grid-cols-2"><input defaultValue="Firdous Rather" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"/><input defaultValue={username} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"/><textarea defaultValue="Building products, learning every day, and sharing the journey." className="min-h-24 resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm sm:col-span-2"/></div> : <><p className="mt-5 max-w-2xl text-sm leading-6 text-gray-600">Building products, learning every day, and sharing the journey. Welcome to my corner of Socialhub.</p><div className="mt-5 flex gap-6 text-sm"><span><strong className="font-black">184</strong> <span className="text-gray-400">posts</span></span><span><strong className="font-black">1.8k</strong> <span className="text-gray-400">followers</span></span><span><strong className="font-black">426</strong> <span className="text-gray-400">following</span></span></div></>}
        <div className="mt-7 flex gap-6 border-b border-gray-100 pb-3 text-xs font-black"><button className="border-b-2 border-[#6d5dfc] pb-3 text-[#5a4be8]">Posts</button><button className="pb-3 text-gray-400">Photos</button><button className="pb-3 text-gray-400">Friends</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{[1,2,3,4].map(n=><article key={n} className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-center gap-3"><Avatar initials="FR" size="sm"/><div><p className="text-xs font-black">Firdous Rather</p><p className="text-[11px] text-gray-400">{n*2}h ago</p></div></div><p className="mt-3 text-sm leading-6 text-gray-600">Small wins add up. Keeping the focus on building, learning, and sharing useful things along the way.</p><div className="mt-4 h-28 rounded-xl bg-gradient-to-br from-violet-100 via-white to-sky-100"/><div className="mt-3 flex gap-5 text-xs font-semibold text-gray-400"><span className="inline-flex items-center gap-1"><Heart size={14}/> {18+n}</span><span className="inline-flex items-center gap-1"><MessageCircle size={14}/> {n+2}</span><span className="inline-flex items-center gap-1"><Bookmark size={14}/>Save</span></div></article>)}</div>
      </div>
    </div>
  </Page>;
}

function Messages() {
  const chats=[["MC","Maya Chen","That sounds great. Send me the draft when you can.","9:42","2",true],["AM","Arjun Mehta","The weekend plan still on?","8:18","0",true],["SM","Sara Malik","Loved the photos ✨","Yesterday","0",false],["DC","Design Crew","Nora: I pushed the latest concept.","Mon","7",false]];
  const [active,setActive]=useState(0); const [draft,setDraft]=useState(""); const current=chats[active];
  return <Page eyebrow="Messages" title="Your conversations" subtitle="Focused one-to-one and group messaging, designed to be easy to pick back up."><div className="grid min-h-[620px] overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)] lg:grid-cols-[330px_1fr]">
    <aside className="border-b border-gray-100 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between border-b border-gray-100 p-4"><h2 className="text-sm font-black">Inbox</h2><button className="social-icon-button"><Pencil size={17}/></button></div><label className="relative m-3 block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input className="h-10 w-full rounded-xl bg-gray-50 pl-10 text-xs font-semibold outline-none focus:bg-white" placeholder="Search messages"/></label><div className="space-y-1 p-2">{chats.map((c,i)=><button key={c[1]} onClick={()=>setActive(i)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${i===active?"bg-[#f4f2ff]":"hover:bg-gray-50"}`}><Avatar initials={c[0]} color={colors[i%colors.length]}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-xs font-black">{c[1]}</p><span className="text-[10px] text-gray-400">{c[3]}</span></div><div className="mt-1 flex gap-2"><p className="truncate text-[11px] text-gray-400">{c[2]}</p>{Number(c[4])>0&&<span className="grid size-5 place-items-center rounded-full bg-[#6d5dfc] text-[9px] font-black text-white">{c[4]}</span>}</div></div></button>)}</div></aside>
    <section className="flex min-h-[620px] flex-col"><div className="flex items-center gap-3 border-b border-gray-100 p-4"><Avatar initials={current[0]} color={colors[active%colors.length]}/><div className="flex-1"><p className="text-sm font-black">{current[1]}</p><p className="text-[11px] text-emerald-500">{current[5]?"Active now":"Active recently"}</p></div><button className="social-icon-button"><Search size={17}/></button><button className="social-icon-button"><MoreHorizontal size={18}/></button></div>
      <div className="flex-1 space-y-4 p-5"><div className="flex justify-center"><span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold text-gray-400">Today</span></div><div className="flex items-end gap-2"><Avatar initials={current[0]} color={colors[active%colors.length]} size="sm"/><div className="max-w-[76%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700">Hey! Have you had a chance to look at the latest idea?</div></div><div className="flex justify-end"><div className="max-w-[76%] rounded-2xl rounded-br-md bg-[#6d5dfc] px-4 py-3 text-sm leading-6 text-white">Yes, I did. I really like the direction. Let me send you a couple of notes.</div></div><div className="flex items-end gap-2"><Avatar initials={current[0]} color={colors[active%colors.length]} size="sm"/><div className="max-w-[76%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700">{current[2]}</div></div></div>
      <div className="border-t border-gray-100 p-3"><div className="flex items-end gap-2 rounded-2xl bg-gray-50 p-2"><button className="grid size-10 place-items-center rounded-xl"><Plus size={18}/></button><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={1} className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" placeholder="Write a message…"/><button onClick={()=>setDraft("")} className="grid size-10 place-items-center rounded-xl bg-gray-950 text-white"><Send size={16}/></button></div></div>
    </section></div></Page>;
}

function Discover() {
  const [q,setQ]=useState(""); const results=useMemo(()=>people.filter(p=>(p[1]+p[2]).toLowerCase().includes(q.toLowerCase())),[q]);
  return <Page eyebrow="Discover" title="Find your next connection" subtitle="Search people, browse topics, and explore conversations worth joining."><div className="space-y-5"><Card><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input value={q} onChange={e=>setQ(e.target.value)} className="h-12 w-full rounded-2xl bg-gray-50 pl-11 text-sm font-semibold outline-none focus:bg-white" placeholder="Search people and usernames…"/></div><div className="mt-4 flex gap-2"><button className="rounded-xl bg-[#eeebff] px-3.5 py-2 text-xs font-black text-[#5a4be8]">People</button>{["Posts","Topics","Communities"].map(x=><button key={x} className="rounded-xl px-3.5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50">{x}</button>)}</div></Card><div className="grid gap-5 md:grid-cols-2"><Card><div className="flex justify-between"><h2 className="text-sm font-black">Suggested people</h2><button className="text-xs font-bold text-[#5a4be8]">See all</button></div><div className="mt-4 space-y-4">{results.map((p,i)=><div key={p[2]} className="flex items-center gap-3"><Avatar initials={p[0]} color={colors[i%colors.length]}/><div className="flex-1"><p className="text-xs font-black">{p[1]}</p><p className="text-[11px] text-gray-400">{p[2]} · {p[3]}</p></div><button className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white"><UserPlus size={15}/></button></div>)}</div></Card><Card><h2 className="text-sm font-black">Trending topics</h2><div className="mt-4 space-y-2">{["#BuildInPublic","#WeekendMoments","#DesignTalk","#Creators"].map((x,i)=><Link key={x} href="#" className="flex items-center gap-3 rounded-2xl p-3 hover:bg-gray-50"><span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-[10px] font-black text-gray-500">0{i+1}</span><span className="flex-1"><span className="block text-xs font-black">{x}</span><span className="text-[11px] text-gray-400">{18-i*3}.4k posts</span></span><ChevronRight size={16} className="text-gray-400"/></Link>)}</div></Card></div></div></Page>;
}

function Friends() {
  const [tab,setTab]=useState("requests");
  return <Page eyebrow="Friends" title="Manage your circle" subtitle="Review requests, discover people you know, and keep your connections organized."><div className="mb-5 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1.5">{[["requests","Requests","4"],["suggestions","Suggestions","8"],["all","All friends","184"]].map(x=><button key={x[0]} onClick={()=>setTab(x[0])} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black ${tab===x[0]?"bg-[#eeebff] text-[#5a4be8]":"text-gray-500"}`}>{x[1]} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px]">{x[2]}</span></button>)}</div><div className="grid gap-4 sm:grid-cols-2">{people.concat(people.slice(0,2)).map((p,i)=><Card key={p[2]+i} className="flex items-center gap-4"><Avatar initials={p[0]} color={colors[i%colors.length]} size="lg"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{p[1]}</p><p className="text-xs text-gray-400">{p[2]}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-gray-400">{p[3]}</p></div>{tab==="requests"?<div className="flex gap-2"><button className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white"><Check size={15}/></button><button className="grid size-9 place-items-center rounded-xl bg-gray-100"><X size={15}/></button></div>:<button className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white"><UserPlus size={15}/></button>}</Card>)}</div></Page>;
}

function Notifications() {
  const items=[[Heart,"Maya Chen liked your post.","18 minutes ago","bg-rose-50 text-rose-500"],[UserPlus,"Nora Patel started following you.","42 minutes ago","bg-violet-50 text-violet-600"],[MessageCircle,"Arjun Mehta mentioned you in a comment.","1 hour ago","bg-sky-50 text-sky-500"],[Users,"You have 4 new friend requests.","3 hours ago","bg-emerald-50 text-emerald-600"],[AtSign,"Sara Malik mentioned you in #WeekendMoments.","Yesterday","bg-amber-50 text-amber-500"]];
  return <Page eyebrow="Notifications" title="Stay in the loop" subtitle="Important activity stays here so you can catch up without hunting through your feed."><Card className="!p-0 overflow-hidden"><div className="flex items-center justify-between border-b border-gray-100 p-5"><h2 className="text-sm font-black">Recent activity</h2><button className="text-xs font-bold text-[#5a4be8]">Mark all as read</button></div>{items.map(([Icon,title,time,color],i)=><button key={String(title)} className="flex w-full gap-3 border-b border-gray-100 p-5 text-left last:border-0 hover:bg-gray-50"><span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${color}`}><Icon size={17}/></span><span className="flex-1"><span className="block text-sm font-bold">{String(title)}</span><span className="mt-1 block text-xs text-gray-400">{String(time)}</span></span>{i<2&&<span className="mt-2 size-2 rounded-full bg-[#6d5dfc]"/>}</button>)}</Card></Page>;
}

function SettingsPage() {
  const [privateAccount,setPrivate]=useState(false),[activity,setActivity]=useState(true),[push,setPush]=useState(true);
  const Toggle=({value,set}:{value:boolean;set:(v:boolean)=>void})=><button onClick={()=>set(!value)} className={`relative h-7 w-12 rounded-full p-1 ${value?"bg-[#6d5dfc]":"bg-gray-200"}`}><span className={`block size-5 rounded-full bg-white transition-transform ${value?"translate-x-5":""}`}/></button>;
  return <Page eyebrow="Settings" title="Make Socialhub yours" subtitle="Control account, privacy, notifications, and security from one place."><div className="grid gap-5 lg:grid-cols-[220px_1fr]"><Card className="h-fit !p-2">{[[Settings,"General"],[Lock,"Privacy"],[Bell,"Notifications"],[Shield,"Security"],[CircleHelp,"Help"]] as const.map(([Icon,label],i)=><button key={String(label)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-xs font-black ${i===0?"bg-[#eeebff] text-[#5a4be8]":"text-gray-500 hover:bg-gray-50"}`}><Icon size={16}/>{String(label)}</button>)}</Card><div className="space-y-5"><Card><h2 className="text-sm font-black">Account</h2><div className="mt-4 space-y-3">{[["Email address","firdous@example.com",Mail],["Username","@firdous",AtSign],["Password","Last changed 14 days ago",KeyRound]].map(([a,b,Icon])=><button key={String(a)} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 p-3 text-left hover:bg-gray-50"><span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-gray-500"><Icon size={16}/></span><span className="flex-1"><span className="block text-xs font-black">{String(a)}</span><span className="text-[11px] text-gray-400">{String(b)}</span></span><ChevronRight size={16} className="text-gray-400"/></button>)}</div></Card><Card><h2 className="text-sm font-black">Privacy & presence</h2>{[["Private account","Only approved followers can see your posts.",privateAccount,setPrivate],["Activity status","Show people when you are active.",activity,setActivity]].map(([a,b,v,s])=><div key={String(a)} className="flex items-center gap-4 border-b border-gray-100 py-4 last:border-0"><div className="flex-1"><p className="text-sm font-bold">{String(a)}</p><p className="text-xs text-gray-400">{String(b)}</p></div><Toggle value={Boolean(v)} set={s as (v:boolean)=>void}/></div>)}</Card><Card><div className="flex items-center gap-4"><div className="flex-1"><p className="text-sm font-bold">Push notifications</p><p className="text-xs text-gray-400">Likes, comments, messages, and friend requests.</p></div><Toggle value={push} set={setPush}/></div></Card><div className="rounded-3xl border border-red-100 bg-red-50 p-5"><div className="flex items-center gap-2 text-red-600"><Trash2 size={17}/><h2 className="text-sm font-black">Danger zone</h2></div><p className="mt-2 text-xs leading-5 text-red-500/75">Deleting your account is permanent and removes your profile, posts, and messages.</p><button className="mt-4 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-xs font-black text-red-600">Delete account</button></div></div></div></Page>;
}

function Admin({ section="overview" }: { section?: string }) {
  const [active,setActive]=useState(section);
  const nav=[["overview","Overview",BarChart3],["users","Users",Users],["posts","Posts",MessageCircle],["reports","Reports",Shield]] as const;
  return <Page eyebrow="Admin" title="Socialhub control center" subtitle="Moderate the community, review reports, and monitor platform health."><div className="grid gap-5 lg:grid-cols-[220px_1fr]"><Card className="h-fit !p-2">{nav.map(([k,l,I])=><button key={k} onClick={()=>setActive(k)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-xs font-black ${active===k?"bg-[#eeebff] text-[#5a4be8]":"text-gray-500 hover:bg-gray-50"}`}><I size={16}/>{l}</button>)}</Card><div className="space-y-5">{active==="overview"?<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Members","12,482","+8.2%"],["Posts today","2,391","+4.9%"],["Reports","17","Needs review"],["Active now","1,284","+6.1%"]].map(x=><Card key={x[0]}><p className="text-xs font-bold text-gray-400">{x[0]}</p><div className="mt-2 flex items-end gap-2"><p className="text-3xl font-black tracking-[-.05em]">{x[1]}</p><span className="text-[10px] font-black text-emerald-500">{x[2]}</span></div></Card>)}</div><Card><div className="flex items-center justify-between"><h2 className="text-sm font-black">Platform health</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600">All systems nominal</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["API latency","126 ms"],["Error rate","0.12%"],["Media processing","98.7%"]].map(x=><div key={x[0]} className="rounded-2xl bg-gray-50 p-4"><p className="text-[11px] text-gray-400">{x[0]}</p><p className="mt-2 text-lg font-black">{x[1]}</p></div>)}</div></Card></>:<Card className="!p-0 overflow-hidden"><div className="flex items-center justify-between border-b border-gray-100 p-5"><div><h2 className="text-sm font-black capitalize">{active}</h2><p className="mt-1 text-xs text-gray-400">Review {active} with moderation-safe actions.</p></div><button className="rounded-xl bg-gray-950 px-3.5 py-2.5 text-xs font-black text-white">Review queue</button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[.12em] text-gray-400"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Activity</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{Array.from({length:6}).map((_,i)=><tr key={i} className="border-t border-gray-100"><td className="px-5 py-4 font-bold">{active==="users"?people[i%4][1]:`Report #${2841+i}`}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">{active==="reports"?"Pending":"Active"}</span></td><td className="px-5 py-4 text-gray-400">{i+2}h ago</td><td className="px-5 py-4 text-right"><button className="rounded-lg border border-gray-200 px-3 py-1.5 text-[10px] font-black">Review</button></td></tr>)}</tbody></table></div></Card>}</div></div></Page>;
}

export function SocialPages({ screen }: { screen: Screen }) {
  if (screen.kind==="login") return <Auth/>;
  if (screen.kind==="signup") return <Auth signup/>;
  if (screen.kind==="profile") return <Profile username={screen.username}/>;
  if (screen.kind==="messages") return <Messages/>;
  if (screen.kind==="discover") return <Discover/>;
  if (screen.kind==="friends") return <Friends/>;
  if (screen.kind==="notifications") return <Notifications/>;
  if (screen.kind==="settings") return <SettingsPage/>;
  if (screen.kind==="admin") return <Admin section={screen.section}/>;
  return <Page eyebrow="Socialhub" title="You're all caught up." subtitle="Use the main navigation to keep exploring the experience."><Card><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Sparkles size={20}/></span><div><h2 className="font-black">This route is ready.</h2><p className="mt-2 text-sm text-gray-500">The screen shell is in place so real data can be connected without redesigning the interface.</p></div></div></Card></Page>;
}
