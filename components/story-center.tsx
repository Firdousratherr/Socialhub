"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Plus, Trash2, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AccountBadge } from "@/components/account-badge";

type Story = {
  id: string;
  mediaUrl: string;
  caption: string | null;
  expiresAt: string;
  hasViewed?: boolean;
  author: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
};

export function StoryCenter({
  stories,
  onStoriesChange,
  className = "",
}: {
  stories: Story[];
  onStoriesChange: (stories: Story[]) => void;
  className?: string;
}) {
  const { data: session } = authClient.useSession();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<"PUBLIC" | "FRIENDS">("PUBLIC");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [storyReplies, setStoryReplies] = useState<Array<{ id: string; content: string; createdAt: string; author: { id: string; name: string; image: string | null; isVerified?: boolean; isOwner?: boolean } }>>([]);
  const [storyReactions, setStoryReactions] = useState<Array<{ id: string; emoji: string; userId: string }>>([]);
  const [myStoryReaction, setMyStoryReaction] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [interactionLoading, setInteractionLoading] = useState(false);

  const authors = Array.from(
    new Map(
      stories.map((story) => [story.author.id, {
        author: story.author,
        viewed: stories.filter((item) => item.author.id === story.author.id).every((item) => item.hasViewed),
        storyIndex: stories.findIndex((item) => item.author.id === story.author.id),
      }]),
    ).values(),
  );
  const active = viewerIndex === null ? null : stories[viewerIndex];

  async function pickPhoto(file: File | undefined) {
    if (!file || uploading || publishing) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not upload story image.");
      setPreview(json.url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not upload story image.");
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!session?.user || !preview || publishing) return;
    setPublishing(true);
    setError("");
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: preview,
          caption: caption.trim() || null,
          audience,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not publish story.");
      onStoriesChange([{ ...json.story, hasViewed: true }, ...stories]);
      setComposerOpen(false);
      setCaption("");
      setPreview(null);
      setAudience("PUBLIC");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not publish story.");
    } finally {
      setPublishing(false);
    }
  }

  async function openStory(index: number) {
    const story = stories[index];
    if (!story) return;
    setViewerIndex(index);
    if (!session?.user || story.hasViewed) return;
    const response = await fetch("/api/stories/" + story.id, { method: "POST" });
    if (response.ok) {
      onStoriesChange(stories.map((item) => item.id === story.id ? { ...item, hasViewed: true } : item));
    }
  }

  useEffect(() => {
    if (!active?.id || !session?.user) {
      setStoryReplies([]);
      setStoryReactions([]);
      setMyStoryReaction(null);
      return;
    }
    let cancelled = false;
    setInteractionLoading(true);
    void fetch("/api/stories/" + active.id, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load story interactions.");
        if (!cancelled) {
          setStoryReplies(json.replies ?? []);
          setStoryReactions((json.reactions ?? []).map((item: { id: string; emoji: string; userId: string }) => ({ id: item.id, emoji: item.emoji, userId: item.userId })));
          setMyStoryReaction(json.myReaction?.emoji ?? null);
        }
      })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load story interactions."); })
      .finally(() => { if (!cancelled) setInteractionLoading(false); });
    return () => { cancelled = true; };
  }, [active?.id, session?.user?.id]);

  async function reactToStory(emoji: string) {
    if (!active || !session?.user) return;
    const response = await fetch("/api/stories/" + active.id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reaction", emoji }) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) { setError(json.error ?? "Could not react to story."); return; }
    setMyStoryReaction(emoji);
    setStoryReactions((items) => [...items.filter((item) => item.userId !== session.user.id), { id: json.reaction.id, emoji, userId: session.user.id }]);
  }

  async function removeStoryReaction() {
    if (!active || !session?.user) return;
    const response = await fetch("/api/stories/" + active.id, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reaction" }) });
    if (response.ok) {
      setMyStoryReaction(null);
      setStoryReactions((items) => items.filter((item) => item.userId !== session.user.id));
    }
  }

  async function replyToStory() {
    if (!active || !session?.user || !replyText.trim() || interactionLoading) return;
    setInteractionLoading(true);
    try {
      const response = await fetch("/api/stories/" + active.id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", content: replyText.trim() }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not reply to story.");
      setStoryReplies((items) => [...items, json.reply]);
      setReplyText("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reply to story.");
    } finally {
      setInteractionLoading(false);
    }
  }

  async function removeStory() {
    if (!active || !session?.user || active.author.id !== session.user.id) return;
    if (!window.confirm("Delete this story?")) return;
    const response = await fetch("/api/stories/" + active.id, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete story.");
      return;
    }
    const next = stories.filter((story) => story.id !== active.id);
    onStoriesChange(next);
    if (!next.length) setViewerIndex(null);
    else setViewerIndex(Math.min(viewerIndex ?? 0, next.length - 1));
  }

  return (
    <>
      <section className={"social-card rounded-3xl p-3 sm:p-4 " + className}>
        <div className="hidden items-center justify-between gap-3 sm:flex">
          <div>
            <h2 className="text-sm font-black">Stories</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-400">Real stories expire after 24 hours.</p>
          </div>
          {session?.user ? (
            <button type="button" onClick={() => setComposerOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-gray-950 px-3 py-2 text-[11px] font-black text-white">
              <Plus size={14} /> Create
            </button>
          ) : null}
        </div>

        {error ? <div role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{error}</div> : null}

        <div className="mt-1 flex gap-3 overflow-x-auto pb-1 sm:mt-4 scrollbar-none">
          {session?.user ? (
            <button type="button" onClick={() => setComposerOpen(true)} className="min-w-[64px] text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full border-2 border-dashed border-[#bdb6ff] bg-[#f8f7ff] text-[#5a4be8]"><Plus size={20}/></div>
              <span className="mt-2 block truncate text-xs font-bold text-gray-600">Your story</span>
            </button>
          ) : null}
          {authors.length ? authors.map(({ author, viewed, storyIndex }) => (
            <button key={author.id} type="button" onClick={() => void openStory(storyIndex)} className="min-w-[64px] text-center">
              <div className={"mx-auto grid size-16 place-items-center rounded-full p-[2px] " + (viewed ? "bg-gray-200" : "bg-gradient-to-br from-[#6d5dfc] via-[#d957ff] to-[#ffb347]")}>
                <div className="grid size-full place-items-center rounded-full bg-white p-[2px]">
                  {author.image ? <img src={author.image} alt="" className="size-full rounded-full object-cover" /> : <span className="grid size-full place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-sm font-black text-white">{author.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span>}
                </div>
              </div>
              <span className="mt-2 flex items-center justify-center gap-1 truncate text-[10px] font-bold text-gray-500">{author.id === session?.user?.id ? "Your story" : author.name.split(" ")[0]}<AccountBadge verified={author.isVerified} owner={author.isOwner} /></span>
            </button>
          )) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
              <Camera size={18} className="text-gray-400" />
              <p className="text-[11px] font-semibold text-gray-400">No active stories yet. Create the first one.</p>
            </div>
          )}
        </div>
      </section>

      {composerOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Create a story</h2><p className="mt-1 text-xs text-gray-400">Your story disappears automatically after 24 hours.</p></div><button type="button" onClick={() => setComposerOpen(false)} className="grid size-9 place-items-center rounded-xl bg-gray-100"><X size={17}/></button></div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { void pickPhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <div className="mt-5 overflow-hidden rounded-3xl bg-gray-50">
              {preview ? <div className="relative"><img src={preview} alt="Story preview" className="max-h-[430px] w-full object-cover"/><button type="button" onClick={() => setPreview(null)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60 text-white"><X size={16}/></button></div> : <button type="button" onClick={() => fileRef.current?.click()} className="grid min-h-64 w-full place-items-center border-2 border-dashed border-gray-200 p-6 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-white text-[#6d5dfc]"><ImageIcon size={21}/></span><span className="mt-3 text-sm font-black">Choose a photo</span><span className="mt-1 text-xs text-gray-400">JPG, PNG, WebP or GIF</span></button>}
            </div>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} rows={3} className="mt-4 w-full resize-none rounded-2xl bg-gray-50 p-3 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Add a caption…" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <select value={audience} onChange={(event) => setAudience(event.target.value as "PUBLIC" | "FRIENDS")} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold">
                <option value="PUBLIC">Everyone</option>
                <option value="FRIENDS">Friends</option>
              </select>
              <button type="button" onClick={() => void publish()} disabled={!preview || uploading || publishing} className="flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white disabled:opacity-40">{publishing ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} {publishing ? "Publishing…" : "Publish story"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {active ? (
        <div className="fixed inset-0 z-[75] bg-black/90 p-3 sm:p-6">
          <div className="mx-auto flex h-full max-w-4xl items-center justify-center">
            <button type="button" onClick={() => setViewerIndex(null)} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white"><X size={19}/></button>
            <button type="button" disabled={viewerIndex === 0} onClick={() => void openStory(Math.max(0, (viewerIndex ?? 0) - 1))} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white disabled:opacity-30"><ChevronLeft size={21}/></button>
            <div className="relative max-h-full max-w-[min(90vw,520px)] overflow-hidden rounded-[2rem] bg-black shadow-2xl">
              <div className="absolute inset-x-3 top-3 z-10 flex gap-1" aria-label={"Story " + ((viewerIndex ?? 0) + 1) + " of " + stories.length}>
                {stories.map((story, index) => <span key={story.id} className={"h-1 flex-1 rounded-full " + (index <= (viewerIndex ?? 0) ? "bg-white" : "bg-white/30")} />)}
              </div>
              <div className="absolute left-3 top-6 z-10 rounded-full bg-black/35 px-2.5 py-1 text-[9px] font-black text-white">{(viewerIndex ?? 0) + 1} / {stories.length}</div>
              <img src={active.mediaUrl} alt={active.caption ?? "Story"} className="max-h-[88vh] w-auto max-w-full object-contain" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-white">
                <p className="flex items-center gap-1.5 text-sm font-black">{active.author.name}<AccountBadge verified={active.author.isVerified} owner={active.author.isOwner}/></p>
                {active.caption ? <p className="mt-1 text-xs leading-5 text-white/85">{active.caption}</p> : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["❤️","😂","😮","😢","🔥","👍"].map((emoji) => <button key={emoji} type="button" onClick={() => myStoryReaction === emoji ? void removeStoryReaction() : void reactToStory(emoji)} className={"rounded-full px-2.5 py-1.5 text-sm " + (myStoryReaction === emoji ? "bg-white text-black" : "bg-white/10 text-white")}>{emoji}</button>)}
                </div>
                {session?.user && active.author.id !== session.user.id ? <div className="mt-3 flex gap-2">
                  <input value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void replyToStory(); } }} maxLength={500} className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-white outline-none placeholder:text-white/50" placeholder="Reply to story…"/>
                  <button type="button" onClick={() => void replyToStory()} disabled={!replyText.trim() || interactionLoading} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-gray-950 disabled:opacity-40">Reply</button>
                </div> : null}
                {storyReplies.length ? <div className="mt-3 max-h-24 space-y-1 overflow-y-auto">{storyReplies.slice(-3).map((reply) => <p key={reply.id} className="text-[10px] text-white/80"><span className="inline-flex items-center gap-1 font-black">{reply.author.name}<AccountBadge verified={reply.author.isVerified} owner={reply.author.isOwner}/></span> {reply.content}</p>)}</div> : null}
                {active.author.id === session?.user?.id ? <button type="button" onClick={() => void removeStory()} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold"><Trash2 size={14}/> Delete</button> : null}
              </div>
            </div>
            <button type="button" disabled={viewerIndex === stories.length - 1} onClick={() => void openStory(Math.min(stories.length - 1, (viewerIndex ?? 0) + 1))} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white disabled:opacity-30"><ChevronRight size={21}/></button>
          </div>
        </div>
      ) : null}
    </>
  );
}
