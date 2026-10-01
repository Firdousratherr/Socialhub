"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Home,
  Image as ImageIcon,
  Loader2,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";

type CommentItem = {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  author: { id: string; name: string; username: string | null; image: string | null };
  replies?: CommentItem[];
};

type Post = {
  id: string;
  authorId: string;
  name: string;
  handle: string;
  initials: string;
  authorImage: string | null;
  timestamp: string;
  copy: string;
  mediaUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "PRIVATE";
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  accent: string;
};

type StoryItem = {
  id: string;
  mediaUrl: string;
  caption: string | null;
  expiresAt: string;
  author: { id: string; name: string; username: string | null; image: string | null };
};

const fallbackPosts: Post[] = [
  {
    id: "sample-1",
    authorId: "sample-user-1",
    name: "Maya Chen",
    handle: "@mayachen",
    initials: "MC",
    authorImage: null,
    timestamp: "18 min",
    copy: "A little progress is still progress. Today I finally shipped the thing I had been putting off. ✨",
    mediaUrl: null,
    visibility: "PUBLIC",
    likes: 248,
    comments: 34,
    shares: 12,
    liked: false,
    saved: false,
    accent: "from-violet-500 via-fuchsia-400 to-amber-300",
  },
  {
    id: "sample-2",
    authorId: "sample-user-2",
    name: "Arjun Mehta",
    handle: "@arjunm",
    initials: "AM",
    authorImage: null,
    timestamp: "1 hr",
    copy: "Weekend walks, good coffee, and a camera roll full of tiny moments worth keeping.",
    mediaUrl: null,
    visibility: "PUBLIC",
    likes: 176,
    comments: 21,
    shares: 8,
    liked: false,
    saved: false,
    accent: "from-sky-500 via-cyan-400 to-emerald-300",
  },
];

const navItems = [
  { label: "Home", icon: Home, active: true, href: "/home" },
  { label: "Discover", icon: Compass, href: "/discover" },
  { label: "Friends", icon: Users, href: "/friends" },
  { label: "Messages", icon: MessageCircle, href: "/messages" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
];

function Avatar({
  name,
  image,
  large = false,
  accent = "from-violet-500 to-sky-400",
}: {
  name: string;
  image?: string | null;
  large?: boolean;
  accent?: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return image ? (
    <img
      src={image}
      alt={name}
      className={large ? "size-12 rounded-full object-cover shadow-sm" : "size-9 rounded-full object-cover shadow-sm"}
    />
  ) : (
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

function timeLabel(createdAt: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}

function CommentThread({
  postId,
  postAuthorId,
  onCountChange,
}: {
  postId: string;
  postAuthorId: string;
  onCountChange: (count: number) => void;
}) {
  const { data: session } = authClient.useSession();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load comments.");
        if (!cancelled) {
          const next = (json.comments ?? []) as CommentItem[];
          setComments(next);
          onCountChange(
            next.reduce((total, item) => total + 1 + (item.replies?.length ?? 0), 0),
          );
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load comments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [postId, onCountChange]);

  async function sendComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user || !text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), parentId: replyTo }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not post comment.");

      const created = { ...json.comment, replies: [] } as CommentItem;
      setComments((current) => {
        if (replyTo) {
          return current.map((item) =>
            item.id === replyTo
              ? { ...item, replies: [...(item.replies ?? []), created] }
              : item,
          );
        }
        return [...current, created];
      });
      setText("");
      setReplyTo(null);
      onCountChange(1);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not post comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-black text-gray-700">Comments</p>
        {replyTo ? (
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-700"
          >
            <X size={13} /> Cancel reply
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-xs text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-center text-xs text-gray-400">
          Be the first to comment.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id}>
              <div className="flex gap-2.5">
                <Avatar name={comment.author.name} image={comment.author.image} />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-white px-3 py-2.5">
                    <p className="text-xs font-black text-gray-900">{comment.author.name}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{comment.content}</p>
                  </div>
                  <div className="mt-1 flex gap-3 px-1 text-[10px] font-bold text-gray-400">
                    <span>{timeLabel(comment.createdAt)}</span>
                    {session?.user ? (
                      <button type="button" onClick={() => setReplyTo(comment.id)} className="hover:text-[#5a4be8]">
                        Reply
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {(comment.replies ?? []).length > 0 ? (
                <div className="ml-10 mt-3 space-y-3 border-l border-gray-200 pl-3">
                  {(comment.replies ?? []).map((reply) => (
                    <div key={reply.id} className="flex gap-2.5">
                      <Avatar name={reply.author.name} image={reply.author.image} />
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl bg-white px-3 py-2.5">
                          <p className="text-xs font-black text-gray-900">{reply.author.name}</p>
                          <p className="mt-1 text-xs leading-5 text-gray-600">{reply.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{error}</div>
      ) : null}

      {session?.user ? (
        <form onSubmit={sendComment} className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs outline-none focus:border-[#bdb6ff] focus:ring-4 focus:ring-[#6d5dfc]/10"
            placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-950 text-white disabled:opacity-40"
            aria-label={replyTo ? "Post reply" : "Post comment"}
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      ) : (
        <Link href="/login" className="mt-4 block rounded-xl bg-white px-3 py-2.5 text-center text-[11px] font-black text-[#5a4be8]">
          Sign in to join the conversation
        </Link>
      )}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onRemove,
}: {
  post: Post;
  currentUserId?: string;
  onRemove: (postId: string) => void;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [shareCount, setShareCount] = useState(post.shares);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.copy);
  const [editVisibility, setEditVisibility] = useState(post.visibility);
  const [savingEdit, setSavingEdit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const isOwner = currentUserId === post.authorId;
  const isSample = post.id.startsWith("sample-");

  useEffect(() => {
    setLiked(post.liked);
    setSaved(post.saved);
    setLikeCount(post.likes);
    setCommentCount(post.comments);
    setShareCount(post.shares);
    setEditText(post.copy);
    setEditVisibility(post.visibility);
  }, [post]);

  async function toggleLike() {
    if (isSample) {
      setLiked((value) => !value);
      setLikeCount((value) => value + (liked ? -1 : 1));
      return;
    }
    const response = await fetch(`/api/posts/${post.id}/like`, { method: liked ? "DELETE" : "POST" });
    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      setLiked(Boolean(json.liked));
      setLikeCount(Number(json.count ?? likeCount));
    }
  }

  async function toggleSave() {
    if (isSample) {
      setSaved((value) => !value);
      return;
    }
    const response = await fetch(`/api/posts/${post.id}/save`, { method: saved ? "DELETE" : "POST" });
    if (response.ok) setSaved(!saved);
  }

  async function sharePost() {
    if (isSample) return;
    const url = `${window.location.origin}/home#post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Socialhub post", text: post.copy.slice(0, 120), url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      const response = await fetch(`/api/posts/${post.id}/share`, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (response.ok) setShareCount(Number(json.shareCount ?? shareCount + 1));
    } catch {
      // User cancelled share or the clipboard is unavailable.
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/home#post-${post.id}`;
    await navigator.clipboard.writeText(url);
    setMenuOpen(false);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editText.trim() || savingEdit || isSample) return;
    setSavingEdit(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editText.trim(),
          mediaUrl: post.mediaUrl,
          visibility: editVisibility,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update post.");
      post.copy = json.post.content ?? "";
      post.visibility = json.post.visibility;
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update post.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deletePost() {
    if (!window.confirm("Delete this post permanently?") || isSample) return;
    const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (response.ok) onRemove(post.id);
    else setError("Could not delete the post.");
  }

  async function reportPost() {
    if (isSample) return;
    const reason = window.prompt("Why are you reporting this post?", "Spam or misleading content");
    if (!reason?.trim()) return;
    const response = await fetch(`/api/posts/${post.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (response.ok) {
      setMenuOpen(false);
      setError("Report submitted. Thank you for helping keep Socialhub safe.");
    } else {
      setError("Could not submit the report.");
    }
  }

  async function blockAuthor() {
    if (!window.confirm(`Block ${post.name}? Their content will disappear from your feed.`)) return;
    const response = await fetch(`/api/users/${post.authorId}/block`, { method: "POST" });
    if (response.ok) onRemove(post.id);
    else setError("Could not block this user.");
  }

  return (
    <article id={`post-${post.id}`} className="social-card overflow-hidden rounded-3xl">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${post.handle.replace(/^@/, "")}`}>
            <Avatar name={post.name} image={post.authorImage} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={`/profile/${post.handle.replace(/^@/, "")}`} className="truncate text-sm font-extrabold text-gray-950 hover:text-[#5a4be8]">
                {post.name}
              </Link>
              <span className="text-gray-300">·</span>
              <span className="text-xs font-medium text-gray-400">{post.timestamp}</span>
            </div>
            <p className="text-xs font-medium text-gray-400">{post.handle}</p>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((value) => !value)}
              className="social-icon-button"
              aria-label="Post options"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={19} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl">
                {isOwner ? (
                  <>
                    <button onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
                      <Pencil size={14} /> Edit post
                    </button>
                    <button onClick={() => void deletePost()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50">
                      <Trash2 size={14} /> Delete post
                    </button>
                  </>
                ) : !isSample ? (
                  <>
                    <button onClick={() => void copyLink()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
                      <Share2 size={14} /> Copy link
                    </button>
                    <button onClick={() => void reportPost()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
                      <ShieldAlert size={14} /> Report post
                    </button>
                    <button onClick={() => void blockAuthor()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
                      <Users size={14} /> Block user
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {editing ? (
          <form onSubmit={saveEdit} className="mt-4 space-y-3">
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={4}
              maxLength={5000}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10"
            />
            <div className="flex items-center justify-between gap-3">
              <select value={editVisibility} onChange={(event) => setEditVisibility(event.target.value as Post["visibility"])} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold outline-none">
                <option value="PUBLIC">Public</option>
                <option value="FRIENDS">Friends</option>
                <option value="PRIVATE">Only me</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600">Cancel</button>
                <button type="submit" disabled={savingEdit || !editText.trim()} className="rounded-xl bg-gray-950 px-3.5 py-2 text-xs font-black text-white disabled:opacity-40">
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-[15px] leading-6 text-gray-700">{post.copy}</p>
        )}

        {post.mediaUrl ? (
          <img src={post.mediaUrl} alt="" className="mt-4 max-h-[520px] w-full rounded-2xl object-cover" />
        ) : (
          <div className={`relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br p-6 sm:p-8 ${post.accent}`}>
            <div className="absolute -right-12 -top-12 size-36 rounded-full bg-white/25 blur-2xl" />
            <div className="absolute -bottom-12 -left-8 size-32 rounded-full bg-white/20 blur-2xl" />
            <div className="relative max-w-sm">
              <div className="mb-6 inline-flex rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90">Socialhub moment</div>
              <p className="text-2xl font-black leading-tight tracking-[-0.04em] text-white sm:text-3xl">Keep the small moments. They become the big story.</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="mt-3 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-3 py-2.5 text-[11px] font-semibold text-[#5a4be8]">{error}</div>
        ) : null}

        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-gray-400">
          <span>{likeCount.toLocaleString()} reactions</span>
          <span>{commentCount} comments · {shareCount} shares</span>
        </div>

        <div className="mt-4 grid grid-cols-4 border-t border-gray-100 pt-3">
          <button onClick={() => void toggleLike()} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${liked ? "bg-rose-50 text-rose-500" : "text-gray-500 hover:bg-gray-50"}`} aria-pressed={liked}>
            <span aria-hidden>{liked ? "♥" : "♡"}</span> Like
          </button>
          <button onClick={() => setCommentsOpen((value) => !value)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${commentsOpen ? "bg-sky-50 text-sky-600" : "text-gray-500 hover:bg-gray-50"}`}>
            <MessageCircle size={17} /> Comment
          </button>
          <button onClick={() => void sharePost()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-500 transition hover:bg-gray-50">
            <Share2 size={17} /> Share
          </button>
          <button onClick={() => void toggleSave()} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${saved ? "bg-violet-50 text-violet-600" : "text-gray-500 hover:bg-gray-50"}`} aria-pressed={saved}>
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} /> Save
          </button>
        </div>

        {commentsOpen ? (
          <CommentThread
            postId={post.id}
            postAuthorId={post.authorId}
            onCountChange={(count) => setCommentCount((value) => value + count)}
          />
        ) : null}
      </div>
    </article>
  );
}

export default function HomeFeed() {
  const { data: session } = authClient.useSession();
  const [feedPosts, setFeedPosts] = useState<Post[]>(fallbackPosts);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [newPost, setNewPost] = useState("");
  const [visibility, setVisibility] = useState<Post["visibility"]>("PUBLIC");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function fetchFeed(before?: string | null, append = false) {
    const query = new URLSearchParams({ take: "20" });
    if (before) query.set("before", before);
    const response = await fetch(`/api/posts?${query.toString()}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Could not load your feed.");
    const mapped = (json.posts ?? []).map((item: {
      id: string;
      authorId: string;
      content: string | null;
      mediaUrl: string | null;
      visibility: Post["visibility"];
      createdAt: string;
      shareCount: number;
      liked: boolean;
      saved: boolean;
      author: { id: string; name: string; username: string | null; image: string | null };
      _count: { likes: number; comments: number };
    }, index: number) => ({
      id: item.id,
      authorId: item.authorId,
      name: item.author.name,
      handle: `@${item.author.username ?? "member"}`,
      initials: item.author.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      authorImage: item.author.image,
      timestamp: timeLabel(item.createdAt),
      copy: item.content ?? "Shared a new moment.",
      mediaUrl: item.mediaUrl,
      visibility: item.visibility,
      accent: ["from-violet-500 via-fuchsia-400 to-amber-300","from-sky-500 via-cyan-400 to-emerald-300","from-emerald-400 via-cyan-400 to-sky-400","from-amber-400 via-rose-400 to-fuchsia-400"][index % 4],
      likes: item._count.likes,
      comments: item._count.comments,
      shares: item.shareCount ?? 0,
      liked: Boolean(item.liked),
      saved: Boolean(item.saved),
    }));

    setNextBefore(json.nextBefore ?? null);
    setFeedPosts((current) => (append ? [...current, ...mapped] : mapped.length ? mapped : current));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [feedResponse, storyResponse] = await Promise.all([
          fetch("/api/posts?take=20", { cache: "no-store" }),
          fetch("/api/stories", { cache: "no-store" }),
        ]);
        const feedJson = await feedResponse.json();
        const storyJson = await storyResponse.json();
        if (cancelled) return;

        if (feedResponse.ok) {
          const mapped = (feedJson.posts ?? []).map((item: {
            id: string; authorId: string; content: string | null; mediaUrl: string | null; visibility: Post["visibility"]; createdAt: string;
            shareCount: number; liked: boolean; saved: boolean;
            author: { id: string; name: string; username: string | null; image: string | null };
            _count: { likes: number; comments: number };
          }, index: number) => ({
            id: item.id,
            authorId: item.authorId,
            name: item.author.name,
            handle: `@${item.author.username ?? "member"}`,
            initials: item.author.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase(),
            authorImage: item.author.image,
            timestamp: timeLabel(item.createdAt),
            copy: item.content ?? "Shared a new moment.",
            mediaUrl: item.mediaUrl,
            visibility: item.visibility,
            accent: ["from-violet-500 via-fuchsia-400 to-amber-300","from-sky-500 via-cyan-400 to-emerald-300","from-emerald-400 via-cyan-400 to-sky-400","from-amber-400 via-rose-400 to-fuchsia-400"][index % 4],
            likes: item._count.likes,
            comments: item._count.comments,
            shares: item.shareCount ?? 0,
            liked: Boolean(item.liked),
            saved: Boolean(item.saved),
          }));
          if (mapped.length) setFeedPosts(mapped);
          setNextBefore(feedJson.nextBefore ?? null);
        }

        if (storyResponse.ok) setStories((storyJson.stories ?? []) as StoryItem[]);
      } catch (loadError) {
        if (!cancelled) setFeedError(loadError instanceof Error ? loadError.message : "Could not load your feed.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !session?.user) return;
    setUploading(true);
    setFeedError("");
    setMediaPreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not upload the image.");
      setMediaUrl(json.url);
    } catch (uploadError) {
      setMediaPreview(null);
      setMediaUrl(null);
      setFeedError(uploadError instanceof Error ? uploadError.message : "Could not upload the image.");
    } finally {
      setUploading(false);
    }
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user || (!newPost.trim() && !mediaUrl) || publishing || uploading) return;
    setPublishing(true);
    setFeedError("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPost.trim() || null, mediaUrl, visibility }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not publish post.");
      const item = json.post;
      const created: Post = {
        id: item.id,
        authorId: item.authorId,
        name: item.author.name,
        handle: `@${item.author.username ?? "member"}`,
        initials: item.author.name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(),
        authorImage: item.author.image,
        timestamp: "just now",
        copy: item.content ?? "Shared a new moment.",
        mediaUrl: item.mediaUrl,
        visibility: item.visibility,
        accent: "from-violet-500 via-fuchsia-400 to-sky-400",
        likes: 0,
        comments: 0,
        shares: 0,
        liked: false,
        saved: false,
      };
      setFeedPosts((current) => [created, ...current]);
      setNewPost("");
      setVisibility("PUBLIC");
      setMediaUrl(null);
      setMediaPreview(null);
    } catch (publishError) {
      setFeedError(publishError instanceof Error ? publishError.message : "Could not publish post.");
    } finally {
      setPublishing(false);
    }
  }

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchFeed(nextBefore, true);
    } catch (loadError) {
      setFeedError(loadError instanceof Error ? loadError.message : "Could not load more posts.");
    } finally {
      setLoadingMore(false);
    }
  }

  const profileHref = session?.user ? `/profile/${session.user.email.split("@")[0]}` : "/login";
  const canSubmit = Boolean(session?.user && (newPost.trim() || mediaUrl) && !publishing && !uploading);
  const visibleStories = useMemo(() => stories.filter((story) => new Date(story.expiresAt) > new Date()).slice(0, 6), [stories]);

  return (
    <main className="min-h-screen bg-transparent pb-20 md:pb-6">
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Socialhub">
            <span className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/20"><Sparkles size={17}/></span>
            <span className="hidden text-base font-black tracking-[-0.03em] text-gray-950 sm:block">Socialhub</span>
          </Link>
          <label className="relative mx-auto hidden max-w-md flex-1 md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
            <input className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-gray-400 focus:border-[#bdb6ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Search people, posts, topics…" aria-label="Search"/>
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="social-icon-button md:hidden" aria-label="Search"><Search size={19}/></button>
            <Link href="/messages" className="social-icon-button" aria-label="Messages"><MessageCircle size={19}/></Link>
            <Link href="/notifications" className="social-icon-button relative" aria-label="Notifications"><Bell size={19}/><span className="absolute right-2 top-2 size-2 rounded-full bg-[#6d5dfc] ring-2 ring-white"/></Link>
            <Link href={profileHref}><Avatar name={session?.user?.name ?? "You"} image={session?.user?.image}/></Link>
            <button className="social-icon-button md:hidden" aria-label="Menu"><Menu size={19}/></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,650px)_300px] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="mb-4 rounded-3xl border border-white/70 bg-white/70 p-2.5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3 rounded-2xl bg-[#f5f2ff] p-3">
                <Link href={profileHref}><Avatar name={session?.user?.name ?? "Your profile"} image={session?.user?.image} large /></Link>
                <div className="min-w-0"><p className="truncate text-sm font-extrabold">Your profile</p><p className="truncate text-xs font-medium text-gray-400">@{session?.user?.email?.split("@")[0] ?? "member"}</p></div>
              </div>
              <nav className="mt-2 space-y-1" aria-label="Primary navigation">
                {navItems.map(({ label, icon: Icon, active, href }) => (
                  <Link key={label} href={href} data-active={active} className="social-nav-link">
                    <Icon size={18} strokeWidth={active ? 2.4 : 2}/><span className="text-sm">{label}</span>
                  </Link>
                ))}
              </nav>
              <div className="my-3 border-t border-gray-100"/>
              <Link href="/settings" className="social-nav-link"><Settings size={18}/><span className="text-sm font-semibold">Settings</span></Link>
            </div>
            <p className="px-3 text-[11px] font-medium leading-5 text-gray-400">Built for thoughtful sharing, meaningful connections, and everyday moments.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">Home</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-gray-950">Your feed</h1></div>
            <button className="social-icon-button bg-white/70" aria-label="Customize feed"><Sparkles size={17}/></button>
          </div>

          {feedError ? <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600"><span>{feedError}</span><button onClick={() => setFeedError("")} aria-label="Dismiss"><X size={14}/></button></div> : null}

          <form onSubmit={publishPost} className="social-card mb-5 rounded-3xl p-4">
            <div className="flex gap-3">
              <Avatar name={session?.user?.name ?? "You"} image={session?.user?.image} accent="from-gray-800 to-gray-500"/>
              <div className="min-w-0 flex-1">
                <textarea value={newPost} onChange={(event) => setNewPost(event.target.value)} disabled={!session?.user || publishing || uploading} rows={2} maxLength={5000} className="w-full resize-none rounded-2xl bg-gray-50 px-4 py-3 text-sm font-medium outline-none placeholder:text-gray-400 focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10 disabled:cursor-not-allowed disabled:opacity-70" placeholder={session?.user ? "What’s happening?" : "Sign in to share a post…"} />
                {mediaPreview ? (
                  <div className="relative mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <img src={mediaPreview} alt="Selected media preview" className="max-h-64 w-full object-cover"/>
                    {uploading ? <div className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Loader2 size={22} className="animate-spin"/></div> : null}
                    <button type="button" onClick={() => { setMediaPreview(null); setMediaUrl(null); }} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove selected photo"><X size={15}/></button>
                  </div>
                ) : null}
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void uploadPhoto(event)} />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={!session?.user || publishing || uploading} onClick={() => fileRef.current?.click()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ImageIcon size={17} className="text-emerald-500"/>Photo</button>
                <label className="flex min-h-10 items-center gap-1 rounded-xl bg-gray-50 px-2.5 text-[10px] font-black text-gray-500">
                  <ShieldAlert size={13} />
                  <select value={visibility} onChange={(event) => setVisibility(event.target.value as Post["visibility"])} disabled={!session?.user} className="bg-transparent outline-none">
                    <option value="PUBLIC">Public</option>
                    <option value="FRIENDS">Friends</option>
                    <option value="PRIVATE">Only me</option>
                  </select>
                  <ChevronDown size={12} />
                </label>
              </div>
              {session?.user ? <button type="submit" disabled={!canSubmit} className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{publishing ? "Posting…" : "Post"}</button> : <Link href="/login" className="rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-black text-white">Sign in</Link>}
            </div>
          </form>

          <div className="space-y-5">
            {feedPosts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={session?.user?.id} onRemove={(postId) => setFeedPosts((current) => current.filter((item) => item.id !== postId))}/>
            ))}

            {nextBefore ? (
              <button onClick={() => void loadMore()} disabled={loadingMore} className="mx-auto flex min-h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-xs font-black text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {loadingMore ? <Loader2 size={15} className="animate-spin"/> : <Plus size={15}/>} {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <div className="py-6 text-center text-[11px] font-semibold text-gray-400">You’re caught up.</div>
            )}
          </div>
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-5">
            <section className="social-card rounded-3xl p-5">
              <div className="flex items-center justify-between"><h2 className="text-sm font-black tracking-[-0.02em]">Stories</h2><Link href="/home" className="text-xs font-bold text-[#6d5dfc]">See all</Link></div>
              <div className="mt-4 flex gap-3 overflow-hidden">
                <button className="min-w-16" aria-label="Create your story">
                  <div className="grid size-16 place-items-center rounded-2xl border-2 border-dashed border-[#c9c4ff] bg-[#f5f2ff] text-[#6d5dfc]"><Plus size={19}/></div>
                  <p className="mt-2 truncate text-[11px] font-bold text-gray-500">Your story</p>
                </button>
                {visibleStories.map((story, index) => (
                  <Link href={`/profile/${story.author.username ?? story.author.id}`} className="min-w-16" key={story.id}>
                    <div className="rounded-[1.15rem] bg-gradient-to-br p-[2px] from-[#6d5dfc] via-[#d957ff] to-[#ffb347]">
                      <div className="rounded-[1rem] bg-white p-[2px]"><Avatar name={story.author.name} image={story.author.image} large accent={["from-emerald-400 to-sky-500","from-pink-400 to-violet-500","from-amber-400 to-orange-500","from-sky-400 to-indigo-500","from-fuchsia-500 to-orange-400"][index % 5]}/></div>
                    </div>
                    <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">{story.author.name.split(" ")[0]}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="social-card rounded-3xl p-5">
              <div className="flex items-center justify-between"><h2 className="text-sm font-black tracking-[-0.02em]">People to follow</h2><Link href="/discover" className="text-xs font-bold text-[#6d5dfc]">View all</Link></div>
              <div className="mt-4 space-y-4">
                {[
                  ["Nora Patel","@norapatel","from-fuchsia-500 to-orange-400"],
                  ["Dev Kapoor","@devk","from-sky-500 to-indigo-500"],
                  ["Zoya Shah","@zoyas","from-amber-400 to-rose-500"],
                ].map(([name, handle, accent]) => (
                  <div key={handle} className="flex items-center gap-3">
                    <Avatar name={name} accent={accent} />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-gray-900">{name}</p><p className="truncate text-[11px] font-medium text-gray-400">{handle}</p></div>
                    <Link href={`/discover?q=${handle.slice(1)}`} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white" aria-label={"Follow " + name}><Plus size={16}/></Link>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-gradient-to-br from-[#171426] to-[#2a2450] p-5 text-white shadow-xl shadow-violet-950/10">
              <Sparkles size={18}/><p className="mt-4 text-sm font-black leading-5">Small updates become meaningful memories when you share them with your people.</p>
            </section>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-2xl shadow-gray-900/10 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        {[
          { Icon: Home, label: "Home", active: true, href: "/home" },
          { Icon: Compass, label: "Discover", active: false, href: "/discover" },
          { Icon: Plus, label: "Create", active: false, href: "/home" },
          { Icon: Bell, label: "Alerts", active: false, href: "/notifications" },
          { Icon: Users, label: "Profile", active: false, href: profileHref },
        ].map(({ Icon, label, active, href }) => (
          <Link href={href} key={label} className={[`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition ${active ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500"}`]}>
            <Icon size={18} strokeWidth={active ? 2.5 : 2}/>{label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
