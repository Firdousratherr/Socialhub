"use client";


import NextImage from "next/image";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bookmark, Compass, Home, LogOut, MessageCircle, Phone, Search, Settings, Sparkles, User, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { MobileMenu } from "@/components/mobile-menu";
import { PlatformAnnouncements } from "@/components/platform-announcements";
import { BottomNav } from "@/components/bottom-nav";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/social-ui";
import CallPanel, { type WebCall } from "@/components/call-panel";
import { useLivePoll } from "@/hooks/use-live-poll";

const navItems = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Calls", href: "/calls", icon: Phone },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePath¶»§q«^