"use client";


import NextImage from "next/image";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { uploadMediaFile } from "@/lib/direct-media-upload";
import { AppShell } from "@/components/app-shell";
import { emitPostSyncEvent, subscribePostSync } from "@/lib/post-sync";
import { emitLiveSync, subscribeLiveSync } from "@/lib/live-sync";
import { useLivePoll } from "@/hooks/use-live-poll";
import { compactCount, fullCount } from "@/lib/compact-count";
import { formatSocialDate } from "@/lib/social-date";
import { PostContent } from "@/components/post-content";
import { StoryCenter } from "@/components/story-center";
import { AccountBadge } from "@/components/account-badge";
import { EmptyState, FollowSuggestion, PostActions, PostComposer, SkeletonCard, Toast } from "@/components/social-ui";
import {
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  Users,
  ShieldAlert,
  Sparkles,
  Trash2,
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
  initials¶»§q«^