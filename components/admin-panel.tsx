"use client";


import NextImage from "next/image";
import { fetchWithTimeout } from "@/lib/client-fetch";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity, BarChart3, Check, Eye, FileText, Gauge, History, Search, Shield,
  ShieldCheck, Trash2, UserRound, Users, X,
} from "lucide-react";
import { AdminInspection } from "@/components/admin-inspection";
import { AdminControlCenter } from "@/components/admin-control-center";
import { emitPostSyncEvent } from "@/lib/post-sync";
import { AccountBadge } from "@/components/account-badge";

type UserRow = {
  id: string; name: string; username: string | null; email: string; image: string | null;
  role: "USER" | "MODERATOR" | "ADMIN"; isActive: boolean; isPrivate: boolean;
  emailVerified: boolean; isVerified: boolean; isOwner: boolean; verifiedAt?: string | null; createdAt: string;
  _count: { posts: number; followers: number; following: number };
};

type ReportRow = {
  id: string; reason: string; status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedTo?: { id: string; name: string; username: string | null } | null;
  moderatorNote?: string | null;
  createdAt: string;
  reporter: { id: string; name: string; username: string | null; image: string | null };
  reportedUser: { id: string; name: string; username: string | null; image: string | null } | null;
  post: { id: string; content: string | null; mediaUrl: string | null; a¶»§q«^