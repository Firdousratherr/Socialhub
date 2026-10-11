"use client";


import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { uploadMediaFile } from "@/lib/direct-media-upload";
import { createPortal } from "react-dom";
import { AdminWorkspace } from "@/components/admin-workspace";
import { AccountBadge } from "@/components/account-badge";
import { emitPostSyncEvent } from "@/lib/post-sync";
import { compactCount, fullCount } from "@/lib/compact-count";
import { formatJoinedDate, formatSocialDate, formatSocialDateTime } from "@/lib/social-date";
import { PostContent } from "@/components/post-content";
import { emitLiveSync, subscribeLiveSync } from "@/lib/live-sync";
import { emitUnreadSummarySync } from "@/hooks/use-unread-summary";
import { useLivePoll } from "@/hooks/use-live-poll";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/social-ui";
import CallPanel, { type WebCall } from "@/components/call-panel";
import {
  ArrowLeft, ArrowRight, AtSign, BarChart3, Bell, Bookmark, Camera, Check,
  ChevronRight, CircleHelp, Compass, Globe2, Heart, Image as ImageIcon,
  KeyRound, Lock, LogIn, Mail, MessageCircle, MoreHorizontal, Pencil, Plus,
  Paperclip, Phone, Search, Send, Settings, Shield, ShieldOff, Share2, Sparkles, Tr¶»§q«^