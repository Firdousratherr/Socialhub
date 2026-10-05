"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Users,
  X,
  ChevronUp,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AccountBadge } from "@/components/account-badge";
import { compactCount, fullCount } from "@/lib/compact-count";
import { formatSocialDate, formatSocialDateTime } from "@/lib/social-date";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"] as const;

type Story = {
  id: string;
  mediaUrl: string;
  mediaType?: "IMAGE" | "VIDEO";
  caption: string | null;
  expiresAt: string;
  createdAt?: string;
  hasViewed?: boolean;
  viewCount?: number;
  reactionCount?: number;
  replyCount?: number;
  author: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    isVerified?: boolean;
    isOwner?: boolean;
  };
};

type StoryReply = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    isVerified?: boolean;
    isOwner?: boolean;
  };
};

type StoryViewer = {
  id: string;
  viewedAt: string;
  viewer: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    isVerified?: boolean;
    isOwner?: boolean;
  };
};

type StoryAnalytics = {
  viewCount: number;
  replyCount: number;
  reactionCount: number;
  likeCount: number;
  reactionCounts: Array<{ emoji: string; count: number }>;
  replies: StoryReply[];
  myReaction: { id: string; emoji: string } | null;
  viewers: StoryViewer[];
  isOwner: boolean;
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SH";
}

function timeRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return minutes + "m left";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? hours + "h " + remainder + "m left" : hours + "h left";
}

export function StoryCenter({
  stories,
  onStoriesChange,
  className = "",
  initialStoryId,
  onInitialStoryHandled,
}: {
  stories: Story[];
  onStoriesChange: (stories: Story[]) => void;
  className?: string;
  initialStoryId?: string | null;
  onInitialStoryHandled?: () => void;
}) {
  const { data: session } = authClient.useSession();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState<{ authorId: string; index: number } | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<"PUBLIC" | "FRIENDS">("PUBLIC");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [storyReplies, setStoryReplies] = useState<StoryReply[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Array<{ emoji: string; count: number }>>([]);
  const [storyViewCount, setStoryViewCount] = useState(0);
  const [storyReplyCount, setStoryReplyCount] = useState(0);
  const [storyReactionCount, setStoryReactionCount] = useState(0);
  const [storyLikeCount, setStoryLikeCount] = useState(0);
  const [storyViewers, setStoryViewers] = useState<StoryViewer[]>([]);
  const [myStoryReaction, setMyStoryReaction] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const activityTouchStartY = useRef<number | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { author: Story["author"]; stories: Story[] }>();
    for (const story of stories) {
      const existing = map.get(story.author.id);
      if (existing) existing.stories.push(story);
      else map.set(story.author.id, { author: story.author, stories: [story] });
    }
    return Array.from(map.values());
  }, [stories]);

  const currentUserId = session?.user?.id ?? null;
  const ownGroup = currentUserId
    ? groups.find((group) => group.author.id === currentUserId)
    : undefined;
  const displayGroups = ownGroup
    ? [ownGroup, ...groups.filter((group) => group.author.id !== currentUserId)]
    : groups;

  const activeGroup = viewer ? displayGroups.find((group) => group.author.id === viewer.authorId) : null;
  const active = activeGroup?.stories[viewer?.index ?? 0] ?? null;
  const activeGroupIndex = activeGroup ? displayGroups.findIndex((group) => group.author.id === activeGroup.author.id) : -1;
  const canGoPrevious = Boolean(viewer && (viewer.index > 0 || activeGroupIndex > 0));
  const canGoNext = Boolean(
    viewer &&
      activeGroup &&
      (viewer.index < activeGroup.stories.length - 1 || activeGroupIndex < displayGroups.length - 1),
  );

  function updateStory(storyId: string, patch: Partial<Story>) {
    onStoriesChange(stories.map((item) => item.id === storyId ? { ...item, ...patch } : item));
  }

  function openStoryById(storyId: string) {
    const group = displayGroups.find((item) => item.stories.some((story) => story.id === storyId));
    if (!group) return;
    const index = group.stories.findIndex((story) => story.id === storyId);
    setShowViewers(false);
    setViewer({ authorId: group.author.id, index: Math.max(0, index) });
  }

  function openStoryGroup(group: { author: Story["author"]; stories: Story[] }) {
    const firstUnviewed = group.stories.findIndex((story) => !story.hasViewed);
    setShowViewers(false);
    setViewer({
      authorId: group.author.id,
      index: firstUnviewed >= 0 ? firstUnviewed : 0,
    });
  }

  useEffect(() => {
    if (!initialStoryId || !stories.length) return;
    const target = stories.find((story) => story.id === initialStoryId);
    if (!target) return;
    openStoryById(initialStoryId);
    onInitialStoryHandled?.();
  }, [initialStoryId, stories.length]);

  useEffect(() => {
    if (!active?.id || !session?.user) {
      setStoryReplies([]);
      setReactionCounts([]);
      setStoryViewers([]);
      setStoryViewCount(active?.viewCount ?? 0);
      setStoryReplyCount(active?.replyCount ?? 0);
      setStoryReactionCount(active?.reactionCount ?? 0);
      setStoryLikeCount(0);
      setMyStoryReaction(null);
      return;
    }

    let cancelled = false;
    setAnalyticsLoading(true);
    setError("");

    void fetch("/api/stories/" + active.id, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load story activity.");
        if (cancelled) return;
        const analytics = json as StoryAnalytics & { story?: Story };
        setStoryReplies(Array.isArray(analytics.replies) ? analytics.replies : []);
        setReactionCounts(Array.isArray(analytics.reactionCounts) ? analytics.reactionCounts : []);
        setStoryViewCount(Number(analytics.viewCount ?? active.viewCount ?? 0));
        setStoryReplyCount(Number(analytics.replyCount ?? active.replyCount ?? 0));
        setStoryReactionCount(Number(analytics.reactionCount ?? active.reactionCount ?? 0));
        setStoryLikeCount(Number(analytics.likeCount ?? 0));
        setStoryViewers(Array.isArray(analytics.viewers) ? analytics.viewers : []);
        setMyStoryReaction(analytics.myReaction?.emoji ?? null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load story activity.");
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.viewCount, active?.replyCount, active?.reactionCount, session?.user?.id]);

  useEffect(() => {
    if (!active?.id || !session?.user || active.hasViewed) return;
    void fetch("/api/stories/" + active.id, { method: "POST" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not record story view.");
        const nextCount = Number(json.viewCount ?? storyViewCount);
        setStoryViewCount(nextCount);
        updateStory(active.id, { hasViewed: true, viewCount: nextCount });
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Could not record story view.");
      });
  }, [active?.id, active?.hasViewed, session?.user?.id]);

  useEffect(() => {
    setReplyText("");
    setShowViewers(false);
    setActivityExpanded(false);
  }, [active?.id]);

  async function pickMedia(file: File | undefined) {
    if (!file || uploading || publishing) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not upload story media.");
      setPreview(json.url);
      setPreviewMediaType(json.mediaType === "VIDEO" ? "VIDEO" : "IMAGE");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not upload story media.");
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
          mediaType: previewMediaType,
          caption: caption.trim() || null,
          audience,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not publish story.");
      const nextStory = { ...json.story, hasViewed: true } as Story;
      onStoriesChange([nextStory, ...stories]);
      setComposerOpen(false);
      setCaption("");
      setPreview(null);
      setPreviewMediaType("IMAGE");
      setAudience("PUBLIC");
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not publish story.");
    } finally {
      setPublishing(false);
    }
  }

  async function removeStory() {
    if (!active || !session?.user || active.author.id !== session.user.id) return;
    if (!window.confirm("Delete this story?")) return;
    const response = await fetch("/api/stories/" + active.id, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error ?? "Could not delete story.");
      return;
    }
    const next = stories.filter((story) => story.id !== active.id);
    onStoriesChange(next);

    const nextGroup = activeGroup?.stories.filter((story) => story.id !== active.id) ?? [];
    if (nextGroup.length) {
      setViewer({ authorId: active.author.id, index: Math.min(viewer?.index ?? 0, nextGroup.length - 1) });
    } else {
      const nextGroups = displayGroups.filter((group) => group.author.id !== active.author.id);
      if (!nextGroups.length) setViewer(null);
      else {
        const replacement = nextGroups[Math.min(activeGroupIndex, nextGroups.length - 1)];
        setViewer({ authorId: replacement.author.id, index: 0 });
      }
    }
  }

  async function reactToStory(emoji: string) {
    if (!active || !session?.user || active.author.id === session.user.id || interactionLoading) return;
    const previousReaction = myStoryReaction;
    setInteractionLoading(true);
    try {
      const response = await fetch("/api/stories/" + active.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reaction", emoji }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not react to story.");
      const nextReactionCount = Number(json.reactionCount ?? storyReactionCount);
      const nextLikeCount = Number(json.likeCount ?? storyLikeCount);
      setMyStoryReaction(emoji);
      setStoryReactionCount(nextReactionCount);
      setStoryLikeCount(nextLikeCount);
      updateStory(active.id, { reactionCount: nextReactionCount });
      setReactionCounts((items) => items.map((item) => {
        if (item.emoji === previousReaction && previousReaction !== emoji) {
          return { ...item, count: Math.max(0, item.count - 1) };
        }
        if (item.emoji === emoji && previousReaction !== emoji) {
          return { ...item, count: item.count + 1 };
        }
        return item;
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not react to story.");
    } finally {
      setInteractionLoading(false);
    }
  }

  async function removeStoryReaction() {
    if (!active || !session?.user || interactionLoading || !myStoryReaction) return;
    const previousReaction = myStoryReaction;
    setInteractionLoading(true);
    try {
      const response = await fetch("/api/stories/" + active.id, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reaction" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not remove reaction.");
      const nextReactionCount = Number(json.reactionCount ?? storyReactionCount);
      const nextLikeCount = Number(json.likeCount ?? storyLikeCount);
      setMyStoryReaction(null);
      setStoryReactionCount(nextReactionCount);
      setStoryLikeCount(nextLikeCount);
      updateStory(active.id, { reactionCount: nextReactionCount });
      setReactionCounts((items) => items.map((item) => item.emoji === previousReaction ? { ...item, count: Math.max(0, item.count - 1) } : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove reaction.");
    } finally {
      setInteractionLoading(false);
    }
  }

  async function replyToStory() {
    if (!active || !session?.user || active.author.id === session.user.id || !replyText.trim() || interactionLoading) return;
    setInteractionLoading(true);
    try {
      const response = await fetch("/api/stories/" + active.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", content: replyText.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not reply to story.");
      setStoryReplies((items) => [...items, json.reply]);
      setStoryReplyCount(Number(json.replyCount ?? storyReplyCount + 1));
      updateStory(active.id, { replyCount: Number(json.replyCount ?? storyReplyCount + 1) });
      setReplyText("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reply to story.");
    } finally {
      setInteractionLoading(false);
    }
  }

  function moveStory(direction: -1 | 1) {
    if (!viewer || !activeGroup) return;
    if (direction < 0 && viewer.index > 0) {
      setViewer({ authorId: activeGroup.author.id, index: viewer.index - 1 });
      return;
    }
    if (direction > 0 && viewer.index < activeGroup.stories.length - 1) {
      setViewer({ authorId: activeGroup.author.id, index: viewer.index + 1 });
      return;
    }

    const nextGroupIndex = activeGroupIndex + direction;
    const nextGroup = displayGroups[nextGroupIndex];
    if (!nextGroup) {
      setViewer(null);
      return;
    }
    setViewer({
      authorId: nextGroup.author.id,
      index: direction > 0
        ? Math.max(0, nextGroup.stories.findIndex((story) => !story.hasViewed))
        : nextGroup.stories.length - 1,
    });
  }

  const totalReactions = storyReactionCount;
  const latestReplies = storyReplies.slice(-3);
  const ownReplyExists = Boolean(session?.user && storyReplies.some((reply) => reply.author.id === session.user.id));

  return (
    <>
      <section className={"social-card overflow-hidden rounded-3xl " + className} aria-label="Stories">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Camera size={16} />
            </span>
            <div>
              <h2 className="text-sm font-black tracking-tight text-[var(--foreground)]">Stories</h2>
              <p className="text-[10px] font-semibold text-[var(--muted)]">Moments from your people</p>
            </div>
          </div>
          {session?.user ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="social-button min-h-9 rounded-xl bg-[var(--surface-muted)] px-3 text-[11px] font-black text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
            >
              <span className="inline-flex items-center gap-1.5"><Plus size={14} /> Create</span>
            </button>
          ) : null}
        </div>

        {error ? <div role="alert" className="mx-4 mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 sm:mx-5">{error}</div> : null}

        <div className="story-rail mt-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-none sm:gap-5 sm:px-5 sm:pb-5">
          {session?.user ? (
            <button
              type="button"
              onClick={() => ownGroup ? openStoryGroup(ownGroup) : setComposerOpen(true)}
              className="group story-rail-item w-[70px] shrink-0 text-center sm:w-[76px]"
              aria-label={ownGroup ? "Open your story" : "Add a story"}
            >
              <span
                className={`story-avatar-ring relative mx-auto grid size-[66px] place-items-center rounded-full p-[3px] sm:size-[72px] ${
                  ownGroup
                    ? "bg-gradient-to-tr from-[#f7b733] via-[#e83e8c] to-[#6d5dfc]"
                    : "border-2 border-dashed border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[var(--surface-muted)]"
                }`}
              >
                <span className="grid size-full place-items-center overflow-hidden rounded-full bg-[var(--surface)] p-[2px]">
                  {ownGroup?.author.image ? (
                    <img src={ownGroup.author.image} alt="" className="size-full rounded-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-sm font-black text-white">
                      {session.user.name ? initials(session.user.name) : "SH"}
                    </span>
                  )}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-[3px] border-[var(--surface)] bg-[var(--accent)] text-white shadow-sm sm:size-7">
                  {ownGroup ? <Plus size={13} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                </span>
              </span>
              <span className="mt-2 block truncate text-[11px] font-extrabold text-[var(--foreground)]">Your story</span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold text-[var(--muted)]">{ownGroup ? "Tap to view" : "Add story"}</span>
            </button>
          ) : null}

          {displayGroups
            .filter((group) => group.author.id !== currentUserId)
            .map((group) => {
              const viewed = group.stories.every((story) => story.hasViewed);
              const total = group.stories.length;
              return (
                <button
                  key={group.author.id}
                  type="button"
                  onClick={() => openStoryGroup(group)}
                  className="group story-rail-item w-[70px] shrink-0 text-center sm:w-[76px]"
                  aria-label={group.author.name + (total > 1 ? " has multiple stories" : "")}
                >
                  <span
                    className={`story-avatar-ring relative mx-auto grid size-[66px] place-items-center rounded-full p-[3px] transition-transform duration-150 group-active:scale-95 sm:size-[72px] ${
                      viewed ? "bg-[var(--surface-muted)] ring-1 ring-[var(--border)]" : "bg-gradient-to-tr from-[#f7b733] via-[#e83e8c] to-[#6d5dfc]"
                    }`}
                  >
                    <span className="grid size-full place-items-center overflow-hidden rounded-full bg-[var(--surface)] p-[2px]">
                      {group.author.image ? (
                        <img src={group.author.image} alt="" className="size-full rounded-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-sm font-black text-white">
                          {initials(group.author.name)}
                        </span>
                      )}
                    </span>
                    {total > 1 ? (
                      <span
                        className="pointer-events-none absolute inset-[1px] rounded-full border border-white/45 opacity-70"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="mt-2 flex items-center justify-center gap-1 truncate text-[11px] font-extrabold text-[var(--foreground)]">
                    <span className="truncate">{group.author.name.split(" ")[0]}</span>
                    <AccountBadge verified={group.author.isVerified} owner={group.author.isOwner} />
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold text-[var(--muted)]">
                    {total > 1 ? "New stories" : viewed ? "Viewed" : "New story"}
                  </span>
                </button>
              );
            })}

          {!displayGroups.length && !session?.user ? (
            <div className="flex min-w-[250px] items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--accent)]"><Camera size={17}/></span>
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--foreground)]">No active stories</p>
                <p className="mt-0.5 text-[10px] leading-4 text-[var(--muted)]">Sign in to start sharing.</p>
              </div>
            </div>
          ) : null}

          {session?.user && !displayGroups.filter((group) => group.author.id !== currentUserId).length ? (
            <div className="flex min-w-[190px] items-center self-center rounded-2xl bg-[var(--surface-muted)] px-3 py-2.5">
              <p className="text-[10px] font-bold leading-4 text-[var(--muted)]">No other stories yet. Add yours and share a moment.</p>
            </div>
          ) : null}
        </div>
      </section>

      {composerOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-black">Create a story</h2><p className="mt-1 text-xs text-gray-500">Your story disappears automatically after 24 hours.</p></div>
              <button type="button" onClick={() => setComposerOpen(false)} className="grid size-9 place-items-center rounded-xl bg-gray-100"><X size={17}/></button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={(event) => { void pickMedia(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <div className="mt-5 overflow-hidden rounded-3xl bg-gray-50">
              {preview ? (
                <div className="relative">
                  <div className="mx-auto aspect-[9/12] max-h-[430px] overflow-hidden bg-black">
                    {previewMediaType === "VIDEO" ? (
                      <video src={preview} className="size-full object-contain" controls muted playsInline preload="metadata" />
                    ) : (
                      <img src={preview} alt="Story preview" className="size-full object-contain"/>
                    )}
                  </div>
                  <button type="button" onClick={() => { setPreview(null); setPreviewMediaType("IMAGE"); }} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60 text-white"><X size={16}/></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="grid min-h-64 w-full place-items-center border-2 border-dashed border-gray-200 p-6 text-center">
                  <span className="grid size-12 place-items-center rounded-2xl bg-white text-[#6d5dfc]">{uploading ? <Loader2 size={21} className="animate-spin"/> : <ImageIcon size={21}/>}</span>
                  <span className="mt-3 text-sm font-black">{uploading ? "Uploading…" : "Choose photo or video"}</span>
                  <span className="mt-1 text-xs text-gray-500">JPG, PNG, WebP, GIF, MP4 or WebM</span>
                </button>
              )}
            </div>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} rows={3} className="mt-4 w-full resize-none rounded-2xl bg-gray-50 p-3 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Add a caption…" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <select value={audience} onChange={(event) => setAudience(event.target.value as "PUBLIC" | "FRIENDS")} className="h-10 appearance-none rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold focus:border-[#bbb3ff] focus:ring-4 focus:ring-[#5a4be8]/10">
                <option value="PUBLIC">Everyone</option>
                <option value="FRIENDS">Friends</option>
              </select>
              <button type="button" onClick={() => void publish()} disabled={!preview || uploading || publishing} className="flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white disabled:opacity-40">
                {publishing ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                {publishing ? "Publishing…" : "Publish story"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {active ? (
        <div className="fixed inset-0 z-[85] overflow-hidden bg-black/95 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={"Story from " + active.author.name}>
          <button type="button" onClick={() => setViewer(null)} className="absolute right-3 top-3 z-30 grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition active:scale-95" aria-label="Close story viewer"><X size={19}/></button>

          <div className="mx-auto flex h-full max-w-5xl items-center justify-center gap-3 sm:gap-5">
            <button type="button" disabled={!canGoPrevious} onClick={() => moveStory(-1)} className="hidden size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-20 sm:grid" aria-label="Previous story"><ChevronLeft size={22}/></button>

            <div className="relative flex h-full max-h-[94vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#09090b] shadow-2xl">
              <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex gap-1.5">
                {activeGroup?.stories.map((story, index) => (
                  <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                    <span className={"block h-full rounded-full " + (index < (viewer?.index ?? 0) ? "w-full bg-white" : index === (viewer?.index ?? 0) ? "w-1/3 bg-white" : "w-0")} />
                  </span>
                ))}
              </div>

              <div className="absolute inset-x-4 top-7 z-20 flex items-center gap-3">
                {active.author.image ? <img src={active.author.image} alt="" className="size-9 rounded-full border border-white/30 object-cover"/> : <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-[11px] font-black text-white">{initials(active.author.name)}</span>}
                <div className="min-w-0 flex-1 text-white">
                  <p className="flex items-center gap-1 truncate text-sm font-black">{active.author.name}<AccountBadge verified={active.author.isVerified} owner={active.author.isOwner}/></p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/65"><Clock3 size={11}/> {timeRemaining(active.expiresAt)} · {active.createdAt ? formatSocialDate(active.createdAt) : ""}</p>
                </div>
                {active.author.id === session?.user?.id ? (
                  <button type="button" onClick={() => setShowViewers((value) => !value)} className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-black " + (showViewers ? "bg-white text-black" : "bg-white/10 text-white")}>
                    <Eye size={13}/> {compactCount(storyViewCount)}
                  </button>
                ) : null}
              </div>

              <div className="relative mx-3 mt-3 h-[48vh] min-h-[270px] max-h-[56vh] overflow-hidden rounded-[1.75rem] bg-black ring-1 ring-white/10 sm:h-[56vh] sm:max-h-[60vh]">
                {active.mediaType === "VIDEO" ? (
                  <video
                    src={active.mediaUrl}
                    className="size-full object-contain"
                    autoPlay
                    muted
                    playsInline
                    controls
                    preload="metadata"
                    aria-label={active.caption ?? "Story video"}
                  />
                ) : (
                  <img src={active.mediaUrl} alt={active.caption ?? "Story image"} className="size-full object-contain" />
                )}

                <button
                  type="button"
                  onClick={() => moveStory(-1)}
                  disabled={!canGoPrevious}
                  className="absolute inset-y-8 left-0 z-10 w-[30%] cursor-w-resize disabled:cursor-default disabled:opacity-0"
                  aria-label="Previous story"
                />
                <button
                  type="button"
                  onClick={() => moveStory(1)}
                  disabled={!canGoNext}
                  className="absolute inset-y-8 right-0 z-10 w-[30%] cursor-e-resize disabled:cursor-default disabled:opacity-0"
                  aria-label="Next story"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-white scrollbar-none sm:px-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3 sm:p-4">
                  {active.caption ? <p className="text-sm leading-6 text-white/90">{active.caption}</p> : null}

                  <div className={"flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black " + (active.caption ? "mt-3" : "")}>
                    <span className="inline-flex items-center gap-1 text-white/70"><Eye size={12}/> {fullCount(storyViewCount)} views</span>
                    <span className="inline-flex items-center gap-1 text-rose-200"><Heart size={12} fill="currentColor"/> {fullCount(storyLikeCount)} likes</span>
                    <span className="inline-flex items-center gap-1 text-white/70"><MessageCircle size={12}/> {fullCount(storyReplyCount)} replies</span>
                  </div>
                </div>

                <div className="mt-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-white/90">Reactions</p>
                    <span className="text-[10px] font-bold text-white/45">{fullCount(totalReactions)} total</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {REACTION_EMOJIS.map((emoji) => {
                      const count = reactionCounts.find((item) => item.emoji === emoji)?.count ?? 0;
                      const activeReaction = myStoryReaction === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          disabled={interactionLoading || active.author.id === session?.user?.id}
                          onClick={() => activeReaction ? void removeStoryReaction() : void reactToStory(emoji)}
                          className={"flex min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-2 transition active:scale-95 " + (activeReaction ? "bg-white text-black" : "bg-white/10 text-white") + (active.author.id === session?.user?.id ? " opacity-70" : "")}
                          aria-label={(activeReaction ? "Remove " : "React with ") + emoji + " (" + count + ")"}
                        >
                          <span className="text-base leading-none">{emoji}</span>
                          <span className="text-[9px] font-black">{compactCount(count)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {active.author.id !== session?.user?.id && session?.user ? (
                  <form onSubmit={(event) => { event.preventDefault(); void replyToStory(); }} className="mt-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative min-w-0 flex-1">
                        <input
                          value={replyText}
                          onChange={(event) => setReplyText(event.target.value)}
                          maxLength={500}
                          className="h-11 w-full rounded-2xl border border-white/10 bg-white/10 px-4 pr-10 text-sm text-white outline-none placeholder:text-white/45 focus:bg-white/15 focus:ring-2 focus:ring-white/10"
                          placeholder={ownReplyExists ? "Send another reply…" : "Reply to this story…"}
                          aria-label="Reply to story"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/35"><MessageCircle size={16}/></span>
                      </div>
                      <button type="submit" disabled={!replyText.trim() || interactionLoading} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-gray-950 shadow disabled:opacity-40" aria-label="Send story reply">
                        {interactionLoading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                      </button>
                    </div>
                  </form>
                ) : null}

                {latestReplies.length ? (
                  <div className="mt-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black text-white/60">
                      <span>{active.author.id === session?.user?.id ? "Story replies" : "Your replies"}</span>
                      <span>{storyReplyCount}</span>
                    </div>
                    <div className="mt-2 max-h-24 space-y-1.5 overflow-y-auto scrollbar-none">
                      {latestReplies.map((reply) => (
                        <p key={reply.id} className="text-xs leading-5 text-white/85">
                          <span className="font-black">{reply.author.id === session?.user?.id ? "You" : reply.author.name}:</span>{" "}
                          {reply.content}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {active.author.id === session?.user?.id ? (
                  <button
                    type="button"
                    onClick={() => { setShowViewers((value) => !value); setActivityExpanded(false); }}
                    className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black text-white/85 transition active:scale-[0.99]"
                    aria-expanded={showViewers}
                  >
                    <ChevronUp size={15} />
                    <span>Pull up for analysis & views</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[9px]">{compactCount(storyViewCount)}</span>
                  </button>
                ) : null}

                {active.author.id === session?.user?.id ? (
                  <button type="button" onClick={() => void removeStory()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15">
                    <Trash2 size={14}/> Delete story
                  </button>
                ) : null}
              </div>

              {analyticsLoading ? <div className="absolute left-4 top-16 z-20 rounded-full bg-black/35 px-2.5 py-1 text-[9px] font-black text-white">Loading activity…</div> : null}
            </div>

            <button type="button" disabled={!canGoNext} onClick={() => moveStory(1)} className="hidden size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-20 sm:grid" aria-label="Next story"><ChevronRight size={22}/></button>

            <div className="fixed inset-x-3 bottom-3 flex justify-between sm:hidden">
              <button type="button" disabled={!canGoPrevious} onClick={() => moveStory(-1)} className="grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-20" aria-label="Previous story"><ChevronLeft size={20}/></button>
              <button type="button" disabled={!canGoNext} onClick={() => moveStory(1)} className="grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-20" aria-label="Next story"><ChevronRight size={20}/></button>
            </div>
          </div>

          {showViewers && active.author.id === session?.user?.id ? (
            <div
              className={"fixed inset-x-0 bottom-0 z-[95] overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#15151c] text-white shadow-2xl transition-[height] duration-200 " +
                (activityExpanded ? "h-[76vh] sm:h-auto sm:max-h-[78vh]" : "h-[22vh] sm:h-auto sm:max-h-[78vh]")}
              onTouchStart={(event: TouchEvent<HTMLDivElement>) => { activityTouchStartY.current = event.touches[0]?.clientY ?? null; }}
              onTouchEnd={(event: TouchEvent<HTMLDivElement>) => {
                const start = activityTouchStartY.current;
                const end = event.changedTouches[0]?.clientY ?? null;
                activityTouchStartY.current = null;
                if (start === null || end === null) return;
                const delta = end - start;
                if (delta < -36) setActivityExpanded(true);
                if (delta > 36) setActivityExpanded(false);
              }}
              role="region"
              aria-label="Story activity"
            >
              <div className="flex justify-center pt-2 sm:hidden">
                <span className="h-1 w-12 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-black">Story activity</p>
                  <p className="mt-0.5 text-xs text-white/55">{fullCount(storyViewCount)} views · {fullCount(totalReactions)} reactions · {fullCount(storyReplyCount)} replies</p>
                </div>
                <button type="button" onClick={() => setShowViewers(false)} className="grid size-9 place-items-center rounded-xl bg-white/10" aria-label="Close story activity"><X size={16}/></button>
              </div>

              {activityExpanded ? (
                <div className="max-h-[calc(76vh-72px)] overflow-y-auto p-3 sm:max-h-[70vh]">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-white/5 p-3 text-center"><p className="text-lg font-black">{fullCount(storyViewCount)}</p><p className="mt-1 text-[9px] font-bold text-white/45">Views</p></div>
                    <div className="rounded-2xl bg-white/5 p-3 text-center"><p className="text-lg font-black">{fullCount(storyLikeCount)}</p><p className="mt-1 text-[9px] font-bold text-white/45">Likes</p></div>
                    <div className="rounded-2xl bg-white/5 p-3 text-center"><p className="text-lg font-black">{fullCount(storyReplyCount)}</p><p className="mt-1 text-[9px] font-bold text-white/45">Replies</p></div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black">Reaction breakdown</p>
                      <span className="text-[9px] font-bold text-white/40">{fullCount(totalReactions)} total</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {REACTION_EMOJIS.map((emoji) => {
                        const count = reactionCounts.find((item) => item.emoji === emoji)?.count ?? 0;
                        return <div key={emoji} className="rounded-xl bg-black/20 px-2 py-2 text-center"><div className="text-base">{emoji}</div><div className="mt-0.5 text-[9px] font-black text-white/65">{compactCount(count)}</div></div>;
                      })}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black">Viewers</p>
                      <span className="text-[9px] font-bold text-white/40">{fullCount(storyViewCount)} total</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {storyViewers.length ? storyViewers.map((view) => (
                        <div key={view.id} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-white/5">
                          {view.viewer.image ? <img src={view.viewer.image} alt="" className="size-9 rounded-full object-cover"/> : <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-[10px] font-black">{initials(view.viewer.name)}</span>}
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-xs font-black">{view.viewer.name}<AccountBadge verified={view.viewer.isVerified} owner={view.viewer.isOwner}/></p>
                            <p className="mt-0.5 truncate text-[9px] text-white/45">@{view.viewer.username ?? "member"} · {formatSocialDateTime(view.viewedAt)}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="py-8 text-center text-xs text-white/50"><Users className="mx-auto mb-2" size={20}/>No viewers yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setActivityExpanded(true)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
                  <span className="text-xs font-black">Swipe up to see viewers & analysis</span>
                  <ChevronUp size={17} className="text-white/60" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
