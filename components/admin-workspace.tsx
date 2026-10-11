"use client";

import { fetchWithTimeout } from "@/lib/client-fetch";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  ChevronRight,
  FileText,
  Gauge,
  History,
  Layers3,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  Smartphone,
  Shield,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { AdminControlCenter } from "@/components/admin-control-center";
import { AdminApplicationControl } from "@/components/admin-application-control";
import { AdminIntelligencePanel } from "@/components/admin-4-0-panel";
import { AdminPanel as LegacyAdminPanel } from "@/components/admin-panel";
import { AccountBadge } from "@/components/account-badge";

type Section =
  | "overview"
  | "people"
  | "safety"
  | "content"
  | "messaging"
  | "insights"
  | "application"
  | "operations"
  | "security"
  | "audit"
  | "legacy";

type UserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  isActive: boolean;
  isPrivate: boolean;
  emailVerified: boolean;
  isVerified: boolean;
  isOwner: boolean;
  verifiedAt?: string | null;
  createdAt: string;
  postingRestrictedUntil?: string | null;
  commentingRestrictedUntil?: string | null;
  messagingRestrictedUntil?: string | null;
  socialRestrictedUntil?: string | null;
  suspendedUntil?: string | null;
  sus¶»§q«^