"use client";


import NextImage from "next/image";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Bookmark, Heart, MessageCircle, Share2, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { compactCount, fullCount } from "@/lib/compact-count";
import { formatSocialDate } from "@/lib/social-date";
import { PostContent } from "@/components/post-content";
import { AppShell } from "@/components/app-shell";

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

  const load = useCallback(async (cursor?: string | null) => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/saved?take=24" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok)¶»§q«^