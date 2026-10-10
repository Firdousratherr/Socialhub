"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Check, ChevronDown, Globe2, Heart, Image as ImageIcon, Lock, MessageCircle, Moon, Share2, Smile, Sun, UserPlus, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export type AudienceValue = "PUBLIC" | "FRIENDS" | "PRIVATE";

const audienceOptions = [
  { value: "PUBLIC" as const, label: "Public", description: "Anyone can see this", Icon: Globe2 },
  { value: "FRIENDS" as const, label: "Friends", description: "Only your friends can see this", Icon: Users },
  { value: "PRIVATE" as const, label: "Only me", description: "Visible only to you", Icon: Lock },
];

function audienceFor(value: AudienceValue) {
  return audienceOptions.find((option) => option.value === value) ?? audienceOptions[0];
}
function formatCompact(value: number) {
  return value > 0 ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value) : "";
}

export function EmptyState({ icon, title, description, actionLabel, actionHref, onAction, compact = false }: {
  icon?: ReactNode; title: string; description: string; actionLabel?: string; actionHref?: string; onAction?: () => void; compact?: boolean;
}) {
  const action = actionLabel
    ? actionHref
      ? <Link href={actionHref} className="social-button mt-5 inline-flex items-center justify-center bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-strong)]">{actionLabel}</Link>
      : onAction
        ? <button type="button" onClick={onAction} className="social-button mt-5 inline-flex items-center justify-center bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-strong)]">{actionLabel}</button>
        : null
    : null;
  return <section className={"social-empty text-center " + (compact ? "p-6" : "p-8 sm:p-10")}>
    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">{icon ?? <MessageCircle size={21} aria-hidden="true" />}</span>
    <h2 className="mt-4 text-sm font-black text-[var(--foreground)]">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--muted)]">{description}</p>
    {action}
  </section>;
}

export function SkeletonCard() {
  return <section className="social-card rounded-3xl p-5" aria-hidden="true">
    <div className="flex items-center gap-3"><span className="social-skeleton size-10 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><span className="social-skeleton block h-3 w-32 rounded-full" /><span className="social-skeleton block h-2.5 w-20 rounded-full" /></div><span className="social-skeleton size-9 rounded-xl" /></div>
    <div className="mt-5 space-y-2.5"><span className="social-skeleton block h-3 w-full rounded-full" /><span className="social-skeleton block h-3 w-full rounded-full" /><span className="social-skeleton block h-3 w-3/5 rounded-full" /></div>
    <span className="social-skeleton mt-4 block aspect-[4/3] w-full rounded-2xl" />
    <div className="mt-4 grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, i) => <span key={i} className="social-skeleton h-10 rounded-xl" />)}</div>
  </section>;
}

export function PostActions({ liked, saved, likeCount, commentCount, shareCount, commentsOpen, onLike, onComment, onShare, onSave, likeCountDisplay, likeCountExact, commentControlId }: {
  liked: boolean; saved: boolean; likeCount: number; commentCount: number; shareCount: number; commentsOpen: boolean;
  onLike: () => void; onComment: () => void; onShare: () => void; onSave: () => void;
  likeCountDisplay?: string; likeCountExact?: string; commentControlId?: string;
}) {
  return <div className="mt-4 border-t border-[var(--border)] pt-3">
    <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--muted)]">
      <span title={likeCountExact ? likeCountExact + " total reactions" : undefined}>{likeCountDisplay ?? (formatCompact(likeCount) ? formatCompact(likeCount) + (likeCount === 1 ? " reaction" : " reactions") : "")}</span>
      <span>{formatCompact(commentCount) ? formatCompact(commentCount) + (commentCount === 1 ? " comment" : " comments") : ""}{commentCount > 0 && shareCount > 0 ? " · " : ""}{formatCompact(shareCount) ? formatCompact(shareCount) + (shareCount === 1 ? " share" : " shares") : ""}</span>
    </div>
    <div className="grid grid-cols-4 gap-1">
      <button type="button" onClick={onLike} className={"social-action-button " + (liked ? "is-active like" : "")} aria-label={liked ? "Unlike post" : "Like post"} aria-pressed={liked}><Heart size={17} fill={liked ? "currentColor" : "none"} aria-hidden="true" /><span>Like</span></button>
      <button type="button" onClick={onComment} className={"social-action-button " + (commentsOpen ? "is-active" : "")} aria-expanded={commentsOpen} aria-controls={commentControlId} aria-label={commentsOpen ? "Hide comments" : "Show comments"}><MessageCircle size={17} aria-hidden="true" /><span>Comment</span></button>
      <button type="button" onClick={onShare} className="social-action-button" aria-label="Share post"><Share2 size={17} aria-hidden="true" /><span>Share</span></button>
      <button type="button" onClick={onSave} className={"social-action-button " + (saved ? "is-active save" : "")} aria-label={saved ? "Remove post from saved" : "Save post"} aria-pressed={saved}><Bookmark size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" /><span>Save</span></button>
    </div>
  </div>;
}

export function PostComposer({ userId, name, image, value, visibility, mediaPreview, uploading, publishing, disabled, canSubmit, onChange, onVisibilityChange, onMediaClick, onRemoveMedia, onEmoji, onSubmit, textareaRef }: {
  userId?: string; name: string; image?: string | null; value: string; visibility: AudienceValue; mediaPreview?: string | null; uploading: boolean; publishing: boolean; disabled?: boolean; canSubmit: boolean;
  onChange: (value: string) => void; onVisibilityChange: (value: AudienceValue) => void; onMediaClick: () => void; onRemoveMedia: () => void; onEmoji: () => void; onSubmit: () => void; textareaRef?: { current: HTMLTextAreaElement | null };
}) {
  const [audienceOpen, setAudienceOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const audience = audienceFor(visibility);
  useEffect(() => {
    if (!audienceOpen) return;
    const close = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setAudienceOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAudienceOpen(false); };
    document.addEventListener("pointerdown", close); window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [audienceOpen]);

  return <form onSubmit={(event) => { event.preventDefault(); if (canSubmit) onSubmit(); }} className="social-card social-composer rounded-3xl p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <Avatar id={userId} name={name} image={image} size="md" />
      <div className="min-w-0 flex-1">
        <textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || uploading || publishing} rows={1} maxLength={5000} className="social-composer-input w-full resize-none" placeholder={disabled ? "Sign in to share a post…" : "What’s on your mind?"} aria-label="Create a post" />
        {mediaPreview ? <div className="relative mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]">
          <img src={mediaPreview} alt="Selected media preview" className="max-h-80 w-full object-cover" />
          {uploading ? <div className="absolute inset-0 grid place-items-center bg-black/25 text-white"><span className="animate-pulse text-xs font-black">Uploading…</span></div> : null}
          <button type="button" onClick={onRemoveMedia} className="social-icon-button absolute right-2 top-2 bg-black/60 text-white hover:bg-black/75" aria-label="Remove selected media"><X size={15} aria-hidden="true" /></button>
        </div> : null}
      </div>
    </div>
    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button type="button" onClick={onMediaClick} disabled={disabled || uploading || publishing} className="social-composer-tool" aria-label="Add photo"><ImageIcon size={17} aria-hidden="true" /><span>Photo</span></button>
        <button type="button" onClick={onEmoji} disabled={disabled || uploading || publishing} className="social-composer-tool" aria-label="Add emoji"><Smile size={17} aria-hidden="true" /><span>Emoji</span></button>
        <div ref={rootRef} className="relative min-w-0">
          <button type="button" onClick={() => setAudienceOpen((open) => !open)} disabled={disabled} className="social-audience-trigger" aria-expanded={audienceOpen} aria-haspopup="listbox">
            <audience.Icon size={16} aria-hidden="true" /><span className="min-w-0 truncate text-left"><span className="block font-black">{audience.label}</span><span className="hidden text-[10px] font-medium text-[var(--muted)] sm:block">{audience.description}</span></span><ChevronDown size={14} className="ml-0.5 shrink-0" aria-hidden="true" />
          </button>
          {audienceOpen ? <div className="social-audience-menu absolute bottom-full left-0 z-40 mb-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] p-1.5 shadow-2xl" role="listbox" aria-label="Post audience">
            {audienceOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={visibility === option.value} onClick={() => { onVisibilityChange(option.value); setAudienceOpen(false); }} className={"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition " + (visibility === option.value ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--accent)]"><option.Icon size={17} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-black">{option.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">{option.description}</span></span>
              {visibility === option.value ? <Check size={16} aria-hidden="true" /> : null}
            </button>)}
          </div> : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className={"text-[11px] font-semibold " + (value.length > 4500 ? "text-amber-600" : "text-[var(--muted)]")}>{value.length > 4500 ? value.length + "/5000" : ""}</span>
        <button type="submit" disabled={!canSubmit} className="social-button bg-[var(--accent)] px-5 text-white shadow-sm hover:bg-[var(--accent-strong)]">{publishing ? "Posting…" : "Post"}</button>
      </div>
    </div>
  </form>;
}

export function FollowSuggestion({ id, name, username, image, bio, isFollowing, isFriend, isPrivate, onFollow, onDismiss }: {
  id: string; name: string; username: string | null; image: string | null; bio?: string | null; isFollowing: boolean; isFriend: boolean; isPrivate: boolean;
  onFollow: (id: string) => void; onDismiss: (id: string) => void;
}) {
  const status = isFriend ? "Friends" : isFollowing ? "Following" : isPrivate ? "Private" : "Follow";
  return <div className="social-suggestion-row flex items-center gap-3 rounded-2xl p-2">
    <Link href={"/profile/" + encodeURIComponent(username ?? id)} className="shrink-0"><Avatar id={id} name={name} image={image} size="md" /></Link>
    <div className="min-w-0 flex-1"><Link href={"/profile/" + encodeURIComponent(username ?? id)} className="block truncate text-xs font-black text-[var(--foreground)] hover:text-[var(--accent)]">{name}</Link><p className="truncate text-[11px] font-medium text-[var(--muted)]">@{username ?? "member"}</p>{bio ? <p className="hidden truncate text-[10px] text-[var(--muted)] 2xl:block">{bio}</p> : null}</div>
    <button type="button" onClick={() => onFollow(id)} disabled={isFriend || isFollowing || isPrivate} className={"social-follow-button " + (isFriend || isFollowing ? "is-done" : "")} aria-label={status + " " + name} aria-pressed={isFriend || isFollowing}>{isFriend ? <Users size={14} aria-hidden="true" /> : isFollowing ? <Check size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}<span>{status}</span></button>
    <button type="button" onClick={() => onDismiss(id)} className="social-icon-button size-9 min-h-9 min-w-9 opacity-70 hover:opacity-100" aria-label={"Dismiss " + name}><X size={14} aria-hidden="true" /></button>
  </div>;
}

export function Toast({ message, onClose, actionLabel, onAction }: { message: string; onClose?: () => void; actionLabel?: string; onAction?: () => void }) {
  if (!message) return null;
  return <div className="social-toast" role="status" aria-live="polite"><span className="min-w-0 flex-1">{message}</span>{actionLabel && onAction ? <button type="button" onClick={onAction} className="rounded-lg px-2 py-1.5 text-[11px] font-black text-[var(--accent)] hover:bg-[var(--accent-soft)]">{actionLabel}</button> : null}{onClose ? <button type="button" onClick={onClose} className="social-toast-close" aria-label="Dismiss notification"><X size={14} aria-hidden="true" /></button> : null}</div>;
}

export function ThemeToggle({ variant = "menu" }: { variant?: "menu" | "setting" }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("socialhub:theme");
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : document.documentElement.dataset.theme === "dark"
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = initial;
    document.documentElement.style.colorScheme = initial;
    setTheme(initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("socialhub:theme", next);
    setTheme(next);
  }

  if (variant === "setting") {
    return (
      <button
        type="button"
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-[var(--surface-muted)]"
        aria-pressed={theme === "dark"}
        aria-label={theme === "dark" ? "Disable dark theme" : "Enable dark theme"}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {theme === "dark" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">Dark theme</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {theme === "dark" ? "Dark theme is enabled." : "Use the darker Socialhub appearance."}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={"relative h-7 w-12 shrink-0 rounded-full p-1 transition " + (theme === "dark" ? "bg-[var(--accent)]" : "bg-gray-200")}
        >
          <span
            className={"block size-5 rounded-full bg-white shadow-sm transition-transform " + (theme === "dark" ? "translate-x-5" : "")}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-black text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
      role="menuitem"
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
