"use client";


import NextImage from "next/image";
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
      ? <Link href={actionHref} className="social-button mt-5 inline-flex items-center justify-center bg-[var(--accent)] text-white ¶»§q«^