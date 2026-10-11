"use client";


import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState, type TouchEvent, useCallback } from "react";
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

const REACTION_EMOJIS = ["â¤ï¸", "ğŸ˜‚", "ğŸ˜®", "ğŸ˜¢", "ğŸ”¥", "ğŸ‘"] as const;
const STORY_IMAGE_DURATION_MS = 5000;

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
    image: strin¶»§q«^