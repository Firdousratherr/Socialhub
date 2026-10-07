export type SocialhubPriority = {
  id: number;
  key: string;
  title: string;
  status: "LIVE" | "EXTENDED" | "IN_PROGRESS" | "FOUNDATION";
  summary: string;
};

export const SOCIALHUB_PRIORITIES: SocialhubPriority[] = [
  { id: 1, key: "core-experience", title: "Core Experience", status: "EXTENDED", summary: "Feed, stories, messaging stability, drafts, navigation and calling." },
  { id: 2, key: "social-graph", title: "Social Graph", status: "LIVE", summary: "Friends, followers, requests, suggestions, block and mute." },
  { id: 3, key: "content", title: "Content", status: "LIVE", summary: "Posts, reactions, comments, stories, saves and sharing." },
  { id: 4, key: "search-discovery", title: "Search & Discovery", status: "EXTENDED", summary: "People, posts, hashtags, trends and personalized For You ranking." },
  { id: 5, key: "privacy-security", title: "Privacy & Security", status: "LIVE", summary: "Privacy controls, sessions, OTP, password recovery and 2FA." },
  { id: 6, key: "trust-safety", title: "Trust & Safety", status: "LIVE", summary: "Reports, moderation, blocks, restrictions and audit trails." },
  { id: 7, key: "admin", title: "Admin Control Center", status: "LIVE", summary: "Users, safety, platform flags, analytics, security, storage and audit." },
  { id: 8, key: "web-android-parity", title: "Web + Android Parity", status: "IN_PROGRESS", summary: "Shared APIs, deep links, push, safe-area behavior and calling." },
  { id: 9, key: "realtime", title: "Realtime", status: "EXTENDED", summary: "Presence, events, messaging sync, notifications and call signaling." },
  { id: 10, key: "media", title: "Media", status: "EXTENDED", summary: "Validated uploads, quotas, blob cleanup and media-asset inventory." },
  { id: 11, key: "smart-social", title: "Smart Social Features", status: "EXTENDED", summary: "Relationship-aware, engagement-aware and recency-aware recommendations." },
  { id: 12, key: "creator-monetization", title: "Creator & Monetization Foundation", status: "FOUNDATION", summary: "Creator profiles, membership intent and feature-gated monetization groundwork." },
];
