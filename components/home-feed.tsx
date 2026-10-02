"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { MobileMenu } from "@/components/mobile-menu";
import { BottomNav } from "@/components/bottom-nav";
import { subscribePostSync } from "@/lib/post-sync";
import { StoryCenter } from "@/components/story-center";
import { AccountBadge } from "@/components/account-badge";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bookmark,
  ChevronDown,
  Compass,
  Home,
  Image as ImageIcon,
  Loader2,
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
  author: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
  replies?: CommentItem[];
};

type Post = {
  id: string;
  authorId: string;
  name: string;
  handle: string;
  initials: string;
  authorImage: string | null;
  authorVerified: boolean;
  authorOwner: boolean;
  timestamp: string;
  copy: string;
  mediaUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "PRIVATE";
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  reactions: Array<{ emoji: string; count: number }>;
  myReaction: string | null;
  accent: string;
};

type StoryItem = {
  id: string;
  mediaUrl: string;
  caption: string | null;
  expiresAt: string;
  author: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
};

type SuggestedUser = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  isPrivate: boolean;
  isFollowing: boolean;
  isFriend: boolean;
};

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

function mapApiPostToFeedPost(
  item: {
    id: string;
    authorId: string;
    content: string | null;
    mediaUrl: string | null;
    visibility: Post["visibility"];
    createdAt: string;
    shareCount: number;
    liked: boolean;
    saved: boolean;
    reactions: Array<{ emoji: string; count: number }>;
    myReaction: string | null;
    author: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
    _count: { likes: number; comments: number };
    displayCounts?: { likes: number; comments: number; shares: number };
  },
  index: number,
): Post {
  return {
    id: item.id,
    authorId: item.authorId,
    name: item.author.name,
    handle: `@${item.author.username ?? "member"}`,
    initials: item.author.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    authorImage: item.author.image,
    authorVerified: Boolean(item.author.isVerified),
    authorOwner: Boolean(item.author.isOwner),
    timestamp: timeLabel(item.createdAt),
    copy: item.content ?? "Shared a new moment.",
    mediaUrl: item.mediaUrl,
    visibility: item.visibility,
    accent: ["from-violet-500 via-fuchsia-400 to-amber-300","from-sky-500 via-cyan-400 to-emerald-300","from-emerald-400 via-cyan-400 to-sky-400","from-amber-400 via-rose-400 to-fuchsia-400"][index % 4],
    likes: item.displayCounts?.likes ?? item._count.likes,
    comments: item.displayCounts?.comments ?? item._count.comments,
    shares: item.displayCounts?.shares ?? item.shareCount ?? 0,
    liked: Boolean(item.liked),
    saved: Boolean(item.saved),
    reactions: item.reactions ?? [],
    myReaction: item.myReaction ?? null,
  };
}

function CommentThread({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange: (count: number) => void;
}) {
  const { data: session } = authClient.useSession();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  async function loadComments(before?: string) {
    const query = before ? `?before=${encodeURIComponent(before)}` : "";
    const response = await fetch(`/api/posts/${postId}/comments${query}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Could not load comments.");
    const next = (json.comments ?? []) as CommentItem[];
    if (before) {
      setComments((current) => [...next, ...current]);
    } else {
      setComments(next);
    }
    if (typeof json.commentCount === "number") onCountChange(json.commentCount);
    setNextBefore(json.nextBefore ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadComments();
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load comments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [postId]);

  async function loadOlder() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      await loadComments(nextBefore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load older comments.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function updateComment(commentId: string) {
    if (!editingCommentText.trim() || savingComment) return;
    setSavingComment(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, content: editingCommentText.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not edit comment.");
      const updated = json.comment as CommentItem;
      setComments((current) => current.map((item) => item.id === commentId ? { ...item, ...updated } : { ...item, replies: (item.replies ?? []).map((reply) => reply.id === commentId ? { ...reply, ...updated } : reply) }));
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not edit comment."); }
    finally { setSavingComment(false); }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not delete comment.");
      setComments((current) => current.filter((item) => item.id !== commentId).map((item) => ({ ...item, replies: (item.replies ?? []).filter((reply) => reply.id !== commentId) })));
      if (typeof json.commentCount === "number") onCountChange(json.commentCount);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete comment."); }
  }

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
            item.id === replyTo ? { ...item, replies: [...(item.replies ?? []), created] } : item,
          );
        }
        return [...current, created];
      });
      setText("");
      setReplyTo(null);
      if (typeof json.commentCount === "number") onCountChange(json.commentCount);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not post comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div id={"comments-" + postId} className="mt-3 border-t border-gray-100 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black text-gray-700">Comments</p>
        {replyTo ? (
          <button type="button" onClick={() => setReplyTo(null)} className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-700">
            <X size={13} /> Cancel reply
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-xs text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center text-xs text-gray-400">
          No comments yet. Start the conversation.
        </div>
      ) : (
        <div className="space-y-4">
          {nextBefore ? (
            <button type="button" onClick={() => void loadOlder()} disabled={loadingMore} className="mx-auto block rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black text-gray-600 disabled:opacity-50">
              {loadingMore ? "Loading…" : "Load older comments"}
            </button>
          ) : null}
          {comments.map((comment) => (
            <div key={comment.id}>
              <div className="flex gap-2.5">
                <Avatar name={comment.author.name} image={comment.author.image} />
                <div className="min-w-0 flex-1">
                  {editingCommentId === comment.id ? (
                    <div className="rounded-2xl border border-[#cfc9ff] bg-white p-2">
                      <textarea value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} rows={2} maxLength={2000} className="w-full resize-none rounded-xl bg-gray-50 p-2 text-xs outline-none"/>
                      <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }} className="text-[10px] font-black text-gray-500">Cancel</button><button type="button" onClick={() => void updateComment(comment.id)} disabled={!editingCommentText.trim() || savingComment} className="rounded-lg bg-gray-950 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40">{savingComment ? "Saving…" : "Save"}</button></div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-black text-gray-900">{comment.author.name}<AccountBadge verified={comment.author.isVerified} owner={comment.author.isOwner} /></p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">{comment.content}</p>
                    </div>
                  )}
                  <div className="mt-1 flex gap-3 px-1 text-[10px] font-bold text-gray-400">
                    <span>{timeLabel(comment.createdAt)}</span>
                    {session?.user ? (
                      <button type="button" onClick={() => setReplyTo(comment.id)} className="hover:text-[#5a4be8]">Reply</button>
                    ) : null}
                    {session?.user?.id === comment.author.id ? <>
                      <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }} className="hover:text-[#5a4be8]" aria-label="Edit comment"><Pencil size={11}/></button>
                      <button type="button" onClick={() => void deleteComment(comment.id)} className="hover:text-red-500" aria-label="Delete comment"><Trash2 size={11}/></button>
                    </> : null}
                  </div>
                </div>
              </div>

              {(comment.replies ?? []).length > 0 ? (
                <div className="ml-10 mt-3 space-y-3 border-l border-gray-200 pl-3">
                  {(comment.replies ?? []).map((reply) => (
                    <div key={reply.id} className="flex gap-2.5">
                      <Avatar name={reply.author.name} image={reply.author.image} />
                      <div className="min-w-0 flex-1">
                        {editingCommentId === reply.id ? (
                          <div className="rounded-2xl border border-[#cfc9ff] bg-white p-2">
                            <textarea value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} rows={2} maxLength={2000} className="w-full resize-none rounded-xl bg-gray-50 p-2 text-xs outline-none"/>
                            <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }} className="text-[10px] font-black text-gray-500">Cancel</button><button type="button" onClick={() => void updateComment(reply.id)} disabled={!editingCommentText.trim() || savingComment} className="rounded-lg bg-gray-950 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40">{savingComment ? "Saving…" : "Save"}</button></div>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-white px-3 py-2.5">
                            <p className="text-xs font-black text-gray-900">{reply.author.name}</p>
                            <p className="mt-1 text-xs leading-5 text-gray-600">{reply.content}</p>
                          </div>
                        )}
                        <div className="mt-1 flex gap-3 px-1 text-[10px] font-bold text-gray-400">
                          <span>{timeLabel(reply.createdAt)}</span>
                          {session?.user?.id === reply.author.id ? <>
                            <button type="button" onClick={() => { setEditingCommentId(reply.id); setEditingCommentText(reply.content); }} className="hover:text-[#5a4be8]" aria-label="Edit reply"><Pencil size={11}/></button>
                            <button type="button" onClick={() => void deleteComment(reply.id)} className="hover:text-red-500" aria-label="Delete reply"><Trash2 size={11}/></button>
                          </> : null}
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
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => { setError(""); setLoading(true); void loadComments().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load comments.")).finally(() => setLoading(false)); }} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-black text-red-700 shadow-sm">Retry</button>
          </div>
        </div>
      ) : null}

      {session?.user ? (
        <form onSubmit={sendComment} className="mt-3 flex gap-2">
          <input value={text} onChange={(event) => setText(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs outline-none focus:border-[#bdb6ff] focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder={replyTo ? "Write a reply…" : "Write a comment…"} maxLength={2000} />
          <button type="submit" disabled={!text.trim() || sending} className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-950 text-white disabled:opacity-40" aria-label={replyTo ? "Post reply" : "Post comment"}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      ) : (
        <Link href="/login" className="mt-4 block rounded-xl bg-white px-3 py-2.5 text-center text-[11px] font-black text-[#5a4be8]">Sign in to join the conversation</Link>
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
  const [reactions, setReactions] = useState(post.reactions ?? []);
  const [myReaction, setMyReaction] = useState<string | null>(post.myReaction ?? null);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayCopy, setDisplayCopy] = useState(post.copy);
  const [editText, setEditText] = useState(post.copy);
  const [editVisibility, setEditVisibility] = useState(post.visibility);
  const [savingEdit, setSavingEdit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const isOwner = currentUserId === post.authorId;
  const handleCommentCountChange = useCallback((count: number) => setCommentCount(count), []);

  useEffect(() => {
    setLiked(post.liked);
    setSaved(post.saved);
    setLikeCount(post.likes);
    setCommentCount(post.comments);
    setShareCount(post.shares);
    setReactions(post.reactions ?? []);
    setMyReaction(post.myReaction ?? null);
    setDisplayCopy(post.copy);
    setEditText(post.copy);
    setEditVisibility(post.visibility);
  }, [post]);

  async function toggleLike() {
    const response = await fetch(`/api/posts/${post.id}/like`, { method: liked ? "DELETE" : "POST" });
    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      setLiked(Boolean(json.liked));
      setLikeCount(Number(json.count ?? likeCount));
    }
  }

  async function reactToPost(emoji: string) {
    const response = await fetch(`/api/posts/${post.id}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      setReactions((current) => {
        const filtered = current.map((item) => item.emoji === myReaction ? { ...item, count: item.count - 1 } : item).filter((item) => item.count > 0);
        const existing = filtered.find((item) => item.emoji === emoji);
        return existing ? filtered.map((item) => item.emoji === emoji ? { ...item, count: item.count + 1 } : item) : [...filtered, { emoji, count: 1 }];
      });
      setMyReaction(emoji);
      setReactionMenuOpen(false);
    }
  }

  async function removePostReaction() {
    const response = await fetch(`/api/posts/${post.id}/reaction`, { method: "DELETE" });
    if (response.ok) {
      setReactions((current) => current.map((item) => item.emoji === myReaction ? { ...item, count: item.count - 1 } : item).filter((item) => item.count > 0));
      setMyReaction(null);
      setReactionMenuOpen(false);
    }
  }

  async function toggleSave() {
    const response = await fetch(`/api/posts/${post.id}/save`, { method: saved ? "DELETE" : "POST" });
    if (response.ok) setSaved(!saved);
  }

  async function sharePost() {
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
    if (!editText.trim() || savingEdit) return;
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
      setDisplayCopy(json.post.content ?? "");
      setEditText(json.post.content ?? "");
      setEditVisibility(json.post.visibility);
      setEditing(false);
      emitPostSyncEvent({ type: "updated", postId: post.id });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update post.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deletePost() {
    if (!window.confirm("Delete this post permanently?")) return;
    const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (response.ok) onRemove(post.id);
    else setError("Could not delete the post.");
  }

  async function reportPost() {
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
              <AccountBadge verified={post.authorVerified} owner={post.authorOwner} />
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
                ) : (
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
                )}
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
          <p className="mt-4 text-[15px] leading-6 text-gray-700">{displayCopy}</p>
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
          <button type="button" onClick={() => setCommentsOpen((value) => !value)} aria-expanded={commentsOpen} aria-controls={"comments-" + post.id} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${commentsOpen ? "bg-sky-50 text-sky-600" : "text-gray-500 hover:bg-gray-50"}`}>
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
            onCountChange={handleCommentCountChange}
          />
        ) : null}
      </div>
    </article>
  );
}

export default function HomeFeed() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [newPost, setNewPost] = useState("");
  const [visibility, setVisibility] = useState<Post["visibility"]>("PUBLIC");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [feedMode, setFeedMode] = useState<"FOR_YOU" | "FOLLOWING" | "FRIENDS" | "LATEST" | "SAVED">("FOR_YOU");
  const [feedModeOpen, setFeedModeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function fetchFeed(before?: string | null, append = false) {
    const query = new URLSearchParams({ take: "20", mode: feedMode });
    if (before) query.set("before", before);
    const response = await fetch(`/api/posts?${query.toString()}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Could not load your feed.");
    const mapped = (json.posts ?? []).map(mapApiPostToFeedPost);

    setNextBefore(json.nextBefore ?? null);
    setFeedPosts((current) => (append ? [...current, ...mapped] : mapped));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [feedResponse, storyResponse, usersResponse] = await Promise.all([
          fetch("/api/posts?take=20&mode=" + encodeURIComponent(feedMode), { cache: "no-store" }),
          fetch("/api/stories", { cache: "no-store" }),
          fetch("/api/users?take=3", { cache: "no-store" }),
        ]);
        const feedJson = await feedResponse.json();
        const storyJson = await storyResponse.json();
        const usersJson = await usersResponse.json();
        if (cancelled) return;

        if (feedResponse.ok) {
          const mapped = (feedJson.posts ?? []).map(mapApiPostToFeedPost);
          setFeedPosts(mapped);
          setNextBefore(feedJson.nextBefore ?? null);
        }

        if (storyResponse.ok) setStories((storyJson.stories ?? []) as StoryItem[]);
        if (usersResponse.ok) setSuggestedUsers((usersJson.users ?? []) as SuggestedUser[]);
      } catch (loadError) {
        if (!cancelled) setFeedError(loadError instanceof Error ? loadError.message : "Could not load your feed.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, feedMode]);

  useEffect(() => {
    const refresh = () => {
      void fetchFeed().catch((loadError) => {
        setFeedError(loadError instanceof Error ? loadError.message : "Could not refresh your feed.");
      });
    };

    const unsubscribe = subscribePostSync((event) => {
      if (event.type === "deleted") {
        setFeedPosts((current) => current.filter((post) => post.id !== event.postId));
        return;
      }
      refresh();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = () => refresh();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [feedMode]);

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
        authorVerified: Boolean(item.author.isVerified),
        authorOwner: Boolean(item.author.isOwner),
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
        reactions: [],
        myReaction: null,
      };
      setFeedPosts((current) => [created, ...current]);
      emitPostSyncEvent({ type: "created", postId: created.id });
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

  const profileHref = session?.user ? "/profile/me" : "/login";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchTerm.trim();
    setSearchOpen(false);
    router.push(query ? `/discover?q=${encodeURIComponent(query)}` : "/discover");
  }
  const canSubmit = Boolean(session?.user && (newPost.trim() || mediaUrl) && !publishing && !uploading);
  const visibleStories = useMemo(() => stories.filter((story) => new Date(story.expiresAt) > new Date()).slice(0, 6), [stories]);

  useEffect(() => {
    const target = window.location.hash.replace(/^#/, "");
    if (!target.startsWith("post-")) return;
    let cancelled = false;

    async function resolveTarget() {
      const scrollToTarget = () => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (document.getElementById(target)) {
        scrollToTarget();
        return;
      }

      const postId = target.slice("post-".length);
      try {
        const response = await fetch("/api/posts/" + encodeURIComponent(postId), { cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        if (cancelled || !response.ok || !json.post) return;

        const item = json.post;
        const mapped: Post = {
          id: item.id,
          authorId: item.authorId,
          name: item.author.name,
          handle: "@" + (item.author.username ?? "member"),
          initials: item.author.name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(),
          authorImage: item.author.image,
          authorVerified: Boolean(item.author.isVerified),
          authorOwner: Boolean(item.author.isOwner),
          timestamp: timeLabel(item.createdAt),
          copy: item.content ?? "Shared a new moment.",
          mediaUrl: item.mediaUrl,
          visibility: item.visibility,
          accent: "from-violet-500 via-fuchsia-400 to-sky-400",
          likes: item.displayCounts?.likes ?? item._count.likes,
            comments: item.displayCounts?.comments ?? item._count.comments,
            shares: item.displayCounts?.shares ?? item.shareCount ?? 0,
          liked: Boolean(item.liked),
          saved: Boolean(item.saved),
          reactions: item.reactions ?? [],
          myReaction: item.myReaction ?? null,
        };
        setFeedPosts((current) => current.some((post) => post.id === mapped.id) ? current : [mapped, ...current]);
        window.setTimeout(scrollToTarget, 120);
      } catch {
        // The target may have been deleted or may be inaccessible.
      }
    }

    void resolveTarget();
    return () => { cancelled = true; };
  }, [feedPosts.length]);

  return (
    <main className="min-h-screen bg-transparent pb-20 md:pb-6">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/88 shadow-[0_10px_35px_rgba(23,20,45,.06)] backdrop-blur-2xl">
        <div className="h-0.5 bg-gradient-to-r from-[#6d5dfc] via-[#9c7cff] to-[#36b8ff]" />
        <div className="mx-auto flex h-[74px] max-w-[1440px] items-center gap-3 px-3 sm:px-6 lg:px-8">
          <Link href="/home" className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-2xl px-1 py-1" aria-label="Socialhub home">
            <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#6d5dfc] via-[#856fff] to-[#36b8ff] text-white shadow-lg shadow-[#6d5dfc]/25 transition duration-200 group-hover:-translate-y-0.5">
              <Sparkles size={18} strokeWidth={2.2}/>
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-[15px] font-black tracking-[-.035em] text-gray-950">Socialhub</span>
              <span className="block text-[9px] font-bold uppercase tracking-[.18em] text-[#7c72c8]">Connect · Share · Belong</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="relative mx-auto hidden w-full max-w-lg flex-1 md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-11 w-full rounded-2xl border border-gray-200/80 bg-gray-50/90 pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-gray-400 focus:border-[#bbb3ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Search people, posts and hashtags…" aria-label="Search Socialhub"/>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setSearchOpen((value) => !value)} className="social-icon-button rounded-2xl border border-transparent bg-gray-50 md:hidden" aria-label="Search" aria-expanded={searchOpen}><Search size={19}/></button>
            <Link href="/messages" className="social-icon-button rounded-2xl border border-transparent bg-gray-50 hover:border-[#e3defe] hover:bg-[#f8f6ff]" aria-label="Messages"><MessageCircle size={19}/></Link>
            <Link href="/notifications" className="social-icon-button relative rounded-2xl border border-transparent bg-gray-50 hover:border-[#e3defe] hover:bg-[#f8f6ff]" aria-label="Notifications">
              <Bell size={19}/>
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#6d5dfc] ring-2 ring-white"/>
            </Link>
            <Link href={profileHref} className="ml-0.5 rounded-2xl p-0.5 transition hover:bg-[#eeebff]">
              <Avatar name={session?.user?.name ?? "You"} image={session?.user?.image}/>
            </Link>
            <MobileMenu />
          </div>
        </div>

        {searchOpen ? (
          <form onSubmit={submitSearch} className="border-t border-gray-100 bg-white/95 px-3 py-3 sm:px-6 md:hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
              <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm font-medium outline-none focus:border-[#bbb3ff] focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Search Socialhub…" aria-label="Search Socialhub"/>
            </div>
          </form>
        ) : null}
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6 lg:hidden"><StoryCenter stories={stories} onStoriesChange={setStories}/></div>

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
          <div className="relative mb-4 flex items-end justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">Home</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-gray-950">Your feed</h1></div>
            <button type="button" onClick={() => setFeedModeOpen((value) => !value)} className="social-icon-button bg-white/70" aria-label="Customize feed" aria-expanded={feedModeOpen}><Sparkles size={17}/></button>
            {feedModeOpen ? <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
              {[
                ["FOR_YOU", "For You"],
                ["FOLLOWING", "Following"],
                ["FRIENDS", "Friends"],
                ["LATEST", "Latest"],
                ["SAVED", "Saved"],
              ].map(([value, label]) => <button key={value} type="button" onClick={() => { setFeedMode(value as typeof feedMode); setFeedModeOpen(false); }} className={"flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold " + (feedMode === value ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-600 hover:bg-gray-50")}>{label}</button>)}
            </div> : null}
          </div>

          {feedError ? <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600"><span>{feedError}</span><button onClick={() => setFeedError("")} aria-label="Dismiss"><X size={14}/></button></div> : null}

          <form id="create-post" onSubmit={publishPost} className="social-card mb-5 scroll-mt-24 rounded-3xl p-4">
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
            {feedPosts.length > 0 ? feedPosts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={session?.user?.id} onRemove={(postId) => setFeedPosts((current) => current.filter((item) => item.id !== postId))}/>
            )) : (
              <section className="social-card rounded-3xl p-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><MessageCircle size={20}/></span>
                <h2 className="mt-4 text-sm font-black">{session?.user ? "Your feed is empty" : "Sign in to build your feed"}</h2>
                <p className="mt-2 text-xs leading-5 text-gray-400">{session?.user ? "Follow people or add your first post to start filling your feed." : "Real posts from the people you connect with will appear here."}</p>
                {!session?.user ? <Link href="/login" className="mt-4 inline-flex rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white">Sign in</Link> : <Link href="/discover" className="mt-4 inline-flex rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-black text-white">Discover people</Link>}
              </section>
            )}

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
            <StoryCenter stories={visibleStories} onStoriesChange={setStories}/>

            <section className="social-card rounded-3xl p-5">
              <div className="flex items-center justify-between"><h2 className="text-sm font-black tracking-[-0.02em]">People to follow</h2><Link href="/discover" className="text-xs font-bold text-[#6d5dfc]">View all</Link></div>
              <div className="mt-4 space-y-4">
                {suggestedUsers.map((user, index) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <Avatar name={user.name} image={user.image} accent={["from-fuchsia-500 to-orange-400","from-sky-500 to-indigo-500","from-amber-400 to-rose-500"][index % 3]} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${user.username ?? user.id}`} className="block truncate text-xs font-extrabold text-gray-900 hover:text-[#5a4be8]">{user.name}</Link>
                      <p className="truncate text-[11px] font-medium text-gray-400">@{user.username ?? "member"}</p>
                    </div>
                    <Link href={`/discover?q=${encodeURIComponent(user.username ?? user.name)}`} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white" aria-label={`Find ${user.name} in Discover`}><Plus size={16}/></Link>
                  </div>
                ))}
                {!suggestedUsers.length ? <p className="py-3 text-xs text-gray-400">No new people to show right now.</p> : null}
              </div>
            </section>

            <section className="rounded-3xl bg-gradient-to-br from-[#171426] to-[#2a2450] p-5 text-white shadow-xl shadow-violet-950/10">
              <Sparkles size={18}/><p className="mt-4 text-sm font-black leading-5">Small updates become meaningful memories when you share them with your people.</p>
            </section>
          </div>
        </aside>
      </div>

      <BottomNav />
    </main>
  );
}
