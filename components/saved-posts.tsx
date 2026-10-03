"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, Share2, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { compactCount, fullCount } from "@/lib/compact-count";
import { BottomNav } from "@/components/bottom-nav";

type SavedPost = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  savedAt: string;
  author: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
  displayCounts: { likes: number; comments: number; shares: number };
};

export default function SavedPosts() {
  const { data: session } = authClient.useSession();
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function load(cursor?: string | null) {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/saved?take=24" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not load saved posts.");
      setPosts((current) => cursor ? [...current, ...(json.posts ?? [])] : (json.posts ?? []));
      setNextCursor(json.nextCursor ?? null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load saved posts.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [session?.user?.id]);

  async function remove(postId: string) {
    const response = await fetch("/api/saved", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
    if (!response.ok) return;
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  if (!session?.user) return <main className="min-h-screen p-6"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center"><Bookmark className="mx-auto text-[#5a4be8]"/><h1 className="mt-3 text-xl font-black">Saved posts</h1><p className="mt-2 text-sm text-gray-500">Sign in to keep posts for later.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white">Sign in</Link></div></main>;

  return <main className="min-h-screen bg-[#f7f7fb] pb-28">
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#6d5dfc]">Library</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">Saved posts</h1><p className="mt-2 text-sm text-gray-500">Keep useful posts in one private place.</p></div>
        <span className="grid size-11 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Bookmark size={19}/></span>
      </div>
      {error ? <div role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}
      <div className="mt-5 space-y-4">
        {loading && !posts.length ? [1,2,3].map((i)=><div key={i} className="h-40 animate-pulse rounded-3xl bg-white"/>)
        : posts.length ? posts.map((post)=><article key={post.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="p-4"><div className="flex items-center gap-3"><Link href={"/profile/"+encodeURIComponent(post.author.username ?? post.author.id)} className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eeebff] text-xs font-black text-[#5a4be8]">{post.author.image ? <img src={post.author.image} alt="" className="size-full object-cover"/> : post.author.name.slice(0,1).toUpperCase()}</Link><div className="min-w-0 flex-1"><Link href={"/profile/"+encodeURIComponent(post.author.username ?? post.author.id)} className="block truncate text-xs font-black">{post.author.name}</Link><p className="text-[10px] text-gray-400">@{post.author.username ?? "member"} · {new Date(post.createdAt).toLocaleDateString()}</p></div><button type="button" onClick={()=>void remove(post.id)} className="grid size-9 place-items-center rounded-xl bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Remove from saved"><Trash2 size={15}/></button></div>
            {post.content ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{post.content}</p> : null}
          </div>
          {post.mediaUrl ? <img src={post.mediaUrl} alt="" className="max-h-[520px] w-full object-cover"/> : null}
          <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-3 text-[10px] font-black text-gray-500"><span title={fullCount(post.displayCounts.likes)+" likes"} className="inline-flex items-center gap-1"><Heart size={14}/>{compactCount(post.displayCounts.likes)}</span><span title={fullCount(post.displayCounts.comments)+" comments"} className="inline-flex items-center gap-1"><MessageCircle size={14}/>{compactCount(post.displayCounts.comments)}</span><span title={fullCount(post.displayCounts.shares)+" shares"} className="inline-flex items-center gap-1"><Share2 size={14}/>{compactCount(post.displayCounts.shares)}</span></div>
        </article>)
        : <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center"><Bookmark className="mx-auto text-gray-300" size={26}/><p className="mt-3 text-sm font-black">Nothing saved yet</p><p className="mt-1 text-xs text-gray-400">Tap Save on a post and it will appear here.</p></div>}
        {nextCursor ? <div className="text-center"><button type="button" onClick={()=>void load(nextCursor)} disabled={loading} className="rounded-full bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{loading ? "Loading…" : "Load more"}</button></div> : null}
      </div>
    </div>
    <BottomNav/>
  </main>;
}
