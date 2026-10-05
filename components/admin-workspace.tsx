"use client";

import { useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { AdminControlCenter } from "@/components/admin-control-center";
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
  suspensionReason?: string | null;
  _count: { posts: number; followers: number; following: number };
};

type UserDetails = {
  user: UserRow & {
    bio?: string | null;
    website?: string | null;
    location?: string | null;
    coverImage?: string | null;
  };
  override: Record<string, number | null> | null;
  actualMetrics: Record<string, number>;
  canEditMetrics: boolean;
  recentReports: any[];
  recentAudit: any[];
  recentSessions: any[];
  recentVerification: any[];
};

type ReportRow = {
  id: string;
  reason: string;
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedTo?: { id: string; name: string; username: string | null } | null;
  moderatorNote?: string | null;
  createdAt: string;
  reporter: { id: string; name: string; username: string | null; image: string | null };
  reportedUser: { id: string; name: string; username: string | null; image: string | null } | null;
  post: { id: string; content: string | null; mediaUrl: string | null; authorId: string } | null;
  comment: { id: string; content: string; authorId: string; postId: string } | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function compact(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 100_000 ? 0 : 1) + "K";
  return String(n);
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        "rounded-[26px] border border-gray-100 bg-white shadow-[0_14px_50px_rgba(31,26,64,0.06)] " +
        className
      }
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  onRefresh,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  onRefresh?: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]">
            <Icon size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#6d5dfc]">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">
              {description}
            </p>
          </div>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-[11px] font-black text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  detail?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-[#f5f3ff] text-[#5a4be8]">
          <Icon size={16} />
        </span>
        <span className="text-2xl font-black tracking-tight text-gray-950">
          {value}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>
      {detail ? <p className="mt-1 text-[10px] text-gray-400">{detail}</p> : null}
    </Card>
  );
}

const NAV: Array<{
  id: Section;
  label: string;
  icon: React.ElementType;
  group: string;
  mobile?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: Gauge, group: "Workspace", mobile: true },
  { id: "people", label: "People", icon: Users, group: "Workspace", mobile: true },
  { id: "safety", label: "Safety", icon: Shield, group: "Trust & Safety", mobile: true },
  { id: "content", label: "Content", icon: FileText, group: "Trust & Safety" },
  { id: "messaging", label: "Messaging", icon: MessageSquare, group: "Trust & Safety" },
  { id: "insights", label: "Insights", icon: BarChart3, group: "Platform" },
  { id: "operations", label: "Operations", icon: Wrench, group: "Platform" },
  { id: "security", label: "Security", icon: ShieldCheck, group: "Platform" },
  { id: "audit", label: "Audit", icon: History, group: "Platform" },
];

function normalizeSection(value?: string): Section {
  const aliases: Record<string, Section> = {
    control: "operations",
    overview: "overview",
    users: "people",
    user360: "people",
    inspection: "messaging",
    moderation: "safety",
    verification: "safety",
    content: "content",
    analytics: "insights",
    audit: "audit",
    security: "security",
    operations: "operations",
    people: "people",
    safety: "safety",
    messaging: "messaging",
    insights: "insights",
    legacy: "legacy",
  };
  return aliases[value ?? "overview"] ?? "overview";
}

export function AdminWorkspace({ section = "overview" }: { section?: string }) {
  const [active, setActive] = useState<Section>(normalizeSection(section));
  const [dashboard, setDashboard] = useState<any>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => setActive(normalizeSection(section)), [section]);

  async function runGlobalSearch() {
    const q = globalQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/search?q=" + encodeURIComponent(q), {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Search failed.");
      setSearchResults(json);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function loadDashboard() {
    setNotice("");
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load dashboard.");
      setDashboard(json);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load dashboard.");
    }
  }

  useEffect(() => {
    if (active === "overview" || active === "insights") void loadDashboard();
  }, [active]);

  const groupedNav = useMemo(() => {
    const map = new Map<string, typeof NAV>();
    for (const item of NAV) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  const go = (next: Section) => {
    setActive(next);
    setNotice("");
    setSearchResults(null);
  };

  const s = dashboard?.stats ?? {};

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 text-gray-950 lg:pb-10">
      <div className="mx-auto max-w-[1440px] px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
        <header className="sticky top-2 z-30 overflow-hidden rounded-[28px] border border-white/10 bg-gray-950 text-white shadow-[0_20px_70px_rgba(10,10,20,0.18)]">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                  <Layers3 size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-300">
                    Socialhub Admin
                  </p>
                  <p className="truncate text-lg font-black tracking-tight">Operations workspace</p>
                </div>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 lg:max-w-xl">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={15} />
                <input
                  value={globalQuery}
                  onChange={(event) => setGlobalQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runGlobalSearch();
                  }}
                  placeholder="Search users, posts, reports or messages"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.07] pl-9 pr-3 text-xs font-medium text-white outline-none placeholder:text-white/30 focus:border-violet-300/40"
                />
              </div>
              <button
                type="button"
                onClick={() => void runGlobalSearch()}
                disabled={searching}
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-gray-950 disabled:opacity-50"
                aria-label="Search admin records"
              >
                {searching ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[225px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-[26px] border border-gray-100 bg-white p-2 shadow-[0_14px_50px_rgba(31,26,64,0.06)]">
              {groupedNav.map(([group, items]) => (
                <div key={group} className="pb-2">
                  <p className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.17em] text-gray-300">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const selected = active === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => go(item.id)}
                          className={
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[11px] font-black transition " +
                            (selected
                              ? "bg-[#eeebff] text-[#5a4be8] shadow-sm"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-950")
                          }
                        >
                          <Icon size={16} />
                          <span className="flex-1">{item.label}</span>
                          {selected ? <ChevronRight size={13} /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => go("legacy")}
                  className={
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[10px] font-black transition " +
                    (active === "legacy"
                      ? "bg-gray-950 text-white"
                      : "text-gray-400 hover:bg-gray-50 hover:text-gray-700")
                  }
                >
                  <Settings2 size={15} />
                  <span className="flex-1">Legacy tools</span>
                </button>
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            {notice ? (
              <div className="flex items-start gap-3 rounded-2xl border border-[#ddd8ff] bg-[#f8f7ff] px-4 py-3 text-xs font-bold text-[#5a4be8]">
                <Bell size={14} className="mt-0.5 shrink-0" />
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  className="ml-auto"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {searchResults ? (
              <GlobalSearchResults
                results={searchResults}
                query={globalQuery}
                onClose={() => setSearchResults(null)}
                onOpenPeople={() => go("people")}
              />
            ) : null}

            {active === "overview" ? (
              <Overview dashboard={dashboard} refresh={loadDashboard} onOpen={go} />
            ) : null}
            {active === "people" ? <PeopleWorkspace onNotice={setNotice} /> : null}
            {active === "safety" ? <SafetyWorkspace onNotice={setNotice} /> : null}
            {active === "content" ? <ContentWorkspace onNotice={setNotice} /> : null}
            {active === "messaging" ? <MessagingWorkspace onNotice={setNotice} /> : null}
            {active === "insights" ? (
              <InsightsWorkspace dashboard={dashboard} onRefresh={loadDashboard} />
            ) : null}
            {active === "operations" ? (
              <>
                <SectionHeader
                  eyebrow="Platform operations"
                  title="Operations"
                  icon={Wrench}
                  description="Runtime controls, announcements, feature flags, storage, system health, and administrator permissions stay available through the existing audited operations center."
                />
                <AdminIntelligencePanel />
                <SectionHeader
                  eyebrow="Existing controls"
                  title="Platform controls"
                  icon={Wrench}
                  description="Legacy settings, feature flags, announcements, storage, health, and moderator permissions remain available below the new operational workspace."
                />
                <AdminControlCenter initialTab="platform" />
              </>
            ) : null}
            {active === "security" ? (
              <>
                <SectionHeader
                  eyebrow="Privileged access"
                  title="Security"
                  icon={ShieldCheck}
                  description="Review privileged sessions, admin accounts, rate-limit state, permissions, and related security operations."
                />
                <AdminControlCenter initialTab="security" />
              </>
            ) : null}
            {active === "audit" ? <AuditWorkspace onNotice={setNotice} /> : null}
            {active === "legacy" ? (
              <Card className="p-5">
                <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:flex-row sm:items-center">
                  <Settings2 size={17} className="shrink-0 text-amber-700" />
                  <div>
                    <p className="text-xs font-black text-amber-900">Compatibility workspace</p>
                    <p className="mt-1 text-[11px] leading-5 text-amber-800/80">
                      The previous admin surface remains available so no established operation is lost while the new information architecture rolls out.
                    </p>
                  </div>
                </div>
                <LegacyPanel />
              </Card>
            ) : null}
          </section>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(18,18,30,0.16)] backdrop-blur lg:hidden">
        {NAV.filter((item) => item.mobile).map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[8px] font-black " +
                (selected ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-400")
              }
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function GlobalSearchResults({
  results,
  query,
  onClose,
  onOpenPeople,
}: {
  results: any;
  query: string;
  onClose: () => void;
  onOpenPeople: () => void;
}) {
  const groups = [
    ["Users", results.users ?? []],
    ["Posts", results.posts ?? []],
    ["Comments", results.comments ?? []],
    ["Reports", results.reports ?? []],
    ["Messages", results.messages ?? []],
    ["Cases", results.cases ?? []],
    ["Appeals", results.appeals ?? []],
  ] as const;
  const count = groups.reduce((sum, [, items]) => sum + items.length, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <Search size={14} className="text-[#5a4be8]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black">
            Search results for “{query}”
          </p>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {count} records returned from the authorized admin search surface.
          </p>
        </div>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-xl hover:bg-white">
          <X size={14} />
        </button>
      </div>
      {groups.every(([, items]) => !items.length) ? (
        <div className="p-8 text-center text-xs text-gray-400">No matching records.</div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {groups.map(([label, items]) =>
            items.length ? (
              <div key={label} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p>
                  {label === "Users" ? (
                    <button onClick={onOpenPeople} className="text-[10px] font-black text-[#5a4be8]">
                      Open People
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 8).map((item: any) => (
                    <div key={item.id} className="rounded-xl bg-gray-50 p-3 text-[11px]">
                      <p className="font-black">
                        {item.name ?? item.reason ?? item.author?.name ?? item.sender?.name ?? "Record"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-gray-500">
                        {item.content ?? item.reason ?? item.status ?? item.email ?? "Admin record"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </Card>
  );
}

function Overview({
  dashboard,
  refresh,
  onOpen,
}: {
  dashboard: any;
  refresh: () => void;
  onOpen: (section: Section) => void;
}) {
  const s = dashboard?.stats ?? {};
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Command overview"
        title="Platform at a glance"
        icon={Gauge}
        description="One screen for activity, trust, content, reports, and the operational signals that should drive the next admin action."
        onRefresh={refresh}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Members" value={compact(s.users)} icon={Users} />
        <MetricCard label="Active members" value={compact(s.activeUsers)} icon={Activity} />
        <MetricCard label="Posts" value={compact(s.posts)} icon={FileText} />
        <MetricCard label="Messages" value={compact(s.messages)} icon={MessageSquare} />
        <MetricCard label="Followers" value={compact(s.follows)} icon={Users} />
        <MetricCard label="Likes" value={compact(s.likes)} icon={Bell} />
        <MetricCard label="Stories" value={compact(s.stories)} icon={Layers3} />
        <MetricCard label="Profile views" value={compact(s.profileViews)} icon={UserRound} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black">Priority queue</p>
              <p className="mt-1 text-[11px] text-gray-400">Open the domain that needs attention.</p>
            </div>
            <Shield size={16} className="text-[#5a4be8]" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ActionTile
              title="Pending reports"
              value={compact(s.pendingReports)}
              detail="Review safety cases"
              onClick={() => onOpen("safety")}
              tone="danger"
            />
            <ActionTile
              title="Verification queue"
              value={compact(s.pendingVerificationRequests)}
              detail="Trust requests"
              onClick={() => onOpen("safety")}
            />
            <ActionTile
              title="Owner accounts"
              value={compact(s.ownerUsers)}
              detail="Protected admins"
              onClick={() => onOpen("security")}
            />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-black">Recent members</p>
          <div className="mt-3 space-y-2">
            {(dashboard?.recentUsers ?? []).slice(0, 5).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-black text-violet-600">
                  {initials(u.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black">{u.name}</p>
                  <p className="truncate text-[10px] text-gray-400">@{u.username ?? "member"}</p>
                </div>
                <span className={u.isActive ? "text-[9px] font-black text-emerald-600" : "text-[9px] font-black text-red-600"}>
                  {u.isActive ? "ACTIVE" : "DISABLED"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActionTile({
  title,
  value,
  detail,
  onClick,
  tone = "default",
}: {
  title: string;
  value: string;
  detail: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm " +
        (tone === "danger" ? "border-red-100 bg-red-50/60" : "border-gray-100 bg-gray-50")
      }
    >
      <p className="text-[10px] font-black uppercase tracking-[0.11em] text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-gray-400">{detail}</p>
    </button>
  );
}

function PeopleWorkspace({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [trust, setTrust] = useState("all");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [tab, setTab] = useState<"users" | "360">("users");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "VERIFY" | "UNVERIFY" | "REVOKE_SESSIONS">("DISABLE");
  const [bulkPreview, setBulkPreview] = useState<{ action: string; requestedCount: number; count: number; skippedOwnerCount: number; missingCount: number } | null>(null);

  async function loadUsers(reset = true) {
    setLoading(true);
    try {
      const url =
        "/api/admin/users?take=50&q=" +
        encodeURIComponent(query) +
        "&trust=" +
        encodeURIComponent(trust) +
        (!reset && before ? "&before=" + encodeURIComponent(before) : "");
      const response = await fetch(url, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load users.");
      setUsers(reset ? json.users ?? [] : [...users, ...(json.users ?? [])]);
      setBefore(json.nextBefore ?? null);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelected([]);
    void loadUsers(true);
  }, [query, trust]);

  async function openUser(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users/" + id, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load user.");
      setDetails(json);
      setTab("360");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load user.");
    } finally {
      setBusy(false);
    }
  }

  async function bulk(action: "ENABLE" | "DISABLE" | "VERIFY" | "UNVERIFY" | "REVOKE_SESSIONS") {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selected, action }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Bulk action failed.");
      onNotice(json.count + " users updated and audited.");
      setSelected([]);
      await loadUsers(true);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function previewBulk() {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selected, action: bulkAction, dryRun: true }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not preview bulk action.");
      setBulkPreview({
        action: json.action ?? bulkAction,
        requestedCount: Number(json.requestedCount ?? selected.length),
        count: Number(json.count ?? 0),
        skippedOwnerCount: Number(json.skippedOwnerCount ?? 0),
        missingCount: Number(json.missingCount ?? 0),
      });
      onNotice("Dry run complete. No accounts were changed.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not preview bulk action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="People"
        title={tab === "users" ? "User management" : "User 360"}
        icon={Users}
        description={
          tab === "users"
            ? "Search accounts, inspect trust state, run guarded bulk operations, and open a complete account profile."
            : "Review profile state, actual metrics, administrative overrides, reports, sessions, verification history, and audit activity."
        }
        onRefresh={() => void loadUsers(true)}
      />

      <Card className="p-2">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => setTab("users")}
            className={"rounded-2xl px-4 py-3 text-xs font-black " + (tab === "users" ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50")}
          >
            Users
          </button>
          <button
            onClick={() => setTab("360")}
            disabled={!details}
            className={"rounded-2xl px-4 py-3 text-xs font-black " + (tab === "360" ? "bg-gray-950 text-white" : "text-gray-500 disabled:opacity-40")}
          >
            User 360
          </button>
        </div>
      </Card>

      {tab === "users" ? (
        <>
          <Card className="p-4">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, username or email"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs outline-none focus:border-[#aaa0ff]"
                />
              </div>
              <select
                value={trust}
                onChange={(event) => setTrust(event.target.value)}
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-black text-gray-600 outline-none"
              >
                <option value="all">All trust states</option>
                <option value="verified">Verified</option>
                <option value="unverified">Standard</option>
                <option value="owner">Owner</option>
              </select>
              <button onClick={() => void loadUsers(true)} className="rounded-xl bg-gray-950 px-4 text-xs font-black text-white">
                Refresh
              </button>
            </div>
            {selected.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                <span className="mr-auto text-[10px] font-black text-violet-700">{selected.length} selected</span>
                <select value={bulkAction} onChange={(event) => { setBulkAction(event.target.value as typeof bulkAction); setBulkPreview(null); }} className="h-9 rounded-xl border border-violet-200 bg-white px-2 text-[10px] font-black text-violet-700" aria-label="Bulk operation to preview">
                  <option value="ENABLE">Enable</option>
                  <option value="DISABLE">Disable</option>
                  <option value="VERIFY">Verify</option>
                  <option value="UNVERIFY">Remove verification</option>
                  <option value="REVOKE_SESSIONS">Revoke sessions</option>
                </select>
                <button type="button" onClick={() => void previewBulk()} disabled={busy} className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-[10px] font-black text-violet-700 disabled:opacity-40">Preview</button>
                <MiniAction label="Enable" onClick={() => void bulk("ENABLE")} />
                <MiniAction label="Disable" danger onClick={() => void bulk("DISABLE")} />
                <MiniAction label="Verify" onClick={() => void bulk("VERIFY")} />
                <MiniAction label="Remove verification" onClick={() => void bulk("UNVERIFY")} />
                <MiniAction label="Revoke sessions" onClick={() => void bulk("REVOKE_SESSIONS")} />
                {bulkPreview ? <span className="w-full text-[10px] font-semibold text-violet-700" role="status">{bulkPreview.count}/{bulkPreview.requestedCount} eligible · {bulkPreview.skippedOwnerCount} owner(s) protected · no changes made</span> : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-gray-50 text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">
                  <tr>
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Trust</th>
                    <th className="px-4 py-3">Reach</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(user.id)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, user.id]
                                : current.filter((id) => id !== user.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black">{user.name}</p>
                            <p className="truncate text-[10px] text-gray-400">@{user.username ?? "member"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-600">{user.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <AccountBadge verified={user.isVerified} owner={user.isOwner} showLabel size="sm" />
                      </td>
                      <td className="px-4 py-3 text-[10px] text-gray-500">
                        {compact(user._count.followers)} followers
                      </td>
                      <td className="px-4 py-3">
                        <span className={user.isActive ? "text-[9px] font-black text-emerald-600" : "text-[9px] font-black text-red-600"}>
                          {user.isActive ? "ACTIVE" : "DISABLED"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => void openUser(user.id)} className="rounded-xl bg-gray-950 px-3 py-2 text-[9px] font-black text-white">
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {users.map((user) => (
                <div key={user.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      className="mt-2"
                      type="checkbox"
                      checked={selected.includes(user.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, user.id]
                            : current.filter((id) => id !== user.id),
                        )
                      }
                    />
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">
                      {initials(user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black">{user.name}</p>
                        <AccountBadge verified={user.isVerified} owner={user.isOwner} size="sm" />
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-gray-400">@{user.username ?? "member"} · {user.role}</p>
                      <p className="mt-2 text-[10px] text-gray-500">
                        {compact(user._count.posts)} posts · {compact(user._count.followers)} followers
                      </p>
                      <button onClick={() => void openUser(user.id)} className="mt-3 rounded-xl bg-gray-950 px-3 py-2 text-[9px] font-black text-white">
                        Open User 360
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {loading && !users.length ? <p className="p-10 text-center text-xs text-gray-400">Loading users…</p> : null}
            {!loading && !users.length ? <p className="p-10 text-center text-xs text-gray-400">No users match the current filters.</p> : null}
            {before ? (
              <div className="border-t border-gray-100 p-4 text-center">
                <button
                  disabled={loading}
                  onClick={() => void loadUsers(false)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-black text-gray-700 disabled:opacity-40"
                >
                  Load more
                </button>
              </div>
            ) : null}
          </Card>
        </>
      ) : details ? (
        <User360 details={details} onNotice={onNotice} onBack={() => setTab("users")} />
      ) : (
        <Card className="p-8 text-center text-xs text-gray-400">Open an account from Users to inspect it.</Card>
      )}
    </div>
  );
}

function MiniAction({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"rounded-xl px-3 py-2 text-[9px] font-black " + (danger ? "bg-red-600 text-white" : "bg-gray-950 text-white")}
    >
      {label}
    </button>
  );
}

function User360({
  details,
  onNotice,
  onBack,
}: {
  details: UserDetails;
  onNotice: (value: string) => void;
  onBack: () => void;
}) {
  const { user, override, actualMetrics, canEditMetrics } = details;
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? "");
  const [role, setRole] = useState<UserRow["role"]>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const [emailVerified, setEmailVerified] = useState(user.emailVerified);
  const [isVerified, setIsVerified] = useState(user.isVerified);
  const [metrics, setMetrics] = useState<Record<string, string>>(
    Object.fromEntries(
      ["posts", "followers", "following", "likesReceived", "commentsReceived", "shares", "profileViews"].map((key) => [
        key,
        override?.[key] == null ? "" : String(override[key]),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users/" + user.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update user.");
      onNotice("User updated and audited.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not update user.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    await save({
      name,
      username: username.trim() || null,
      role,
      isActive,
      isPrivate,
      emailVerified,
      isVerified,
    });
  }

  async function saveMetrics() {
    if (!canEditMetrics) return;
    const payload = Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, value.trim() === "" ? null : Number(value)]),
    );
    await save({ metrics: payload });
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-black text-gray-500 hover:text-gray-950">
        <ArrowLeft size={14} />
        Back to users
      </button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-lg font-black text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black">{user.name}</h2>
              <AccountBadge verified={user.isVerified} owner={user.isOwner} showLabel size="sm" />
            </div>
            <p className="mt-1 text-xs text-gray-400">@{user.username ?? "member"} · {user.email}</p>
            <p className="mt-1 text-[10px] text-gray-400">Joined {new Date(user.createdAt).toLocaleString()}</p>
          </div>
          <span className={isActive ? "rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700" : "rounded-full bg-red-50 px-3 py-1.5 text-[9px] font-black text-red-700"}>
            {isActive ? "ACTIVE" : "DISABLED"}
          </span>
        </div>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        {["posts", "likesReceived", "commentsReceived", "followers", "following", "shares", "profileViews"].map((key) => (
          <MetricCard
            key={key}
            label={key.replace(/[A-Z]/g, (letter) => " " + letter)}
            value={compact(actualMetrics[key])}
            icon={key === "followers" || key === "following" ? Users : key === "posts" ? FileText : key === "profileViews" ? UserRound : Activity}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Profile controls</p>
              <p className="mt-1 text-[10px] text-gray-400">All changes are protected by the existing admin permission checks.</p>
            </div>
            <UserCog size={16} className="text-[#5a4be8]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={name} onChange={setName} />
            <Field label="Username" value={username} onChange={setUsername} />
            <SelectField label="Role" value={role} onChange={(value) => setRole(value as UserRow["role"])} options={["USER", "MODERATOR", "ADMIN"]} />
            <ToggleField label="Active" value={isActive} onChange={setIsActive} />
            <ToggleField label="Private profile" value={isPrivate} onChange={setIsPrivate} />
            <ToggleField label="Email verified" value={emailVerified} onChange={setEmailVerified} />
            <ToggleField label="Blue verification" value={isVerified} onChange={setIsVerified} />
          </div>
          <button
            disabled={saving}
            onClick={() => void saveProfile()}
            className="mt-4 w-full rounded-xl bg-gray-950 py-3 text-[10px] font-black text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save profile controls"}
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Enforcement status</p>
              <p className="mt-1 text-[10px] text-gray-400">Live restrictions applied by the platform APIs.</p>
            </div>
            <Shield size={16} className="text-[#5a4be8]" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["Account", user.suspendedUntil ? "Suspended" : isActive ? "Active" : "Disabled", user.suspendedUntil],
              ["Posting", user.postingRestrictedUntil ? "Restricted" : "Allowed", user.postingRestrictedUntil],
              ["Commenting", user.commentingRestrictedUntil ? "Restricted" : "Allowed", user.commentingRestrictedUntil],
              ["Messaging", user.messagingRestrictedUntil ? "Restricted" : "Allowed", user.messagingRestrictedUntil],
              ["Social", user.socialRestrictedUntil ? "Restricted" : "Allowed", user.socialRestrictedUntil],
            ].map(([label, value, until]) => (
              <div key={String(label)} className="rounded-2xl bg-gray-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[.11em] text-gray-400">{String(label)}</p>
                <p className={"mt-1 text-xs font-black " + (value === "Restricted" || value === "Suspended" || value === "Disabled" ? "text-red-600" : "text-emerald-600")}>{String(value)}</p>
                {until ? <p className="mt-1 text-[9px] text-gray-400">Until {new Date(String(until)).toLocaleString()}</p> : null}
              </div>
            ))}
          </div>
          {user.suspensionReason ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-[10px] text-red-700">Reason: {user.suspensionReason}</p> : null}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Public display metrics</p>
              <p className="mt-1 text-[10px] text-gray-400">
                Actual metrics remain visible separately from administrator overrides.
              </p>
            </div>
            <Gauge size={16} className="text-[#5a4be8]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["followers", "following", "posts", "likesReceived", "commentsReceived", "shares", "profileViews"].map((key) => (
              <Field
                key={key}
                label={key.replace(/[A-Z]/g, (letter) => " " + letter)}
                value={metrics[key] ?? ""}
                disabled={!canEditMetrics}
                onChange={(value) => setMetrics((current) => ({ ...current, [key]: value }))}
                inputMode="numeric"
              />
            ))}
          </div>
          <button
            disabled={saving || !canEditMetrics}
            onClick={() => void saveMetrics()}
            className="mt-4 w-full rounded-xl bg-[#5a4be8] py-3 text-[10px] font-black text-white disabled:opacity-40"
          >
            {canEditMetrics ? (saving ? "Saving…" : "Save metrics override") : "Administrator role required"}
          </button>
          <div className="mt-3 rounded-2xl bg-gray-50 p-3 text-[10px] text-gray-500">
            Live posts {compact(actualMetrics.posts)} · live followers {compact(actualMetrics.followers)} · live profile views {compact(actualMetrics.profileViews)}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TimelineCard title="Reports" items={details.recentReports} render={(item) => item.reason + " · " + item.status} />
        <TimelineCard title="Sessions" items={details.recentSessions} render={(item) => (item.ipAddress ?? "IP unavailable") + " · " + new Date(item.updatedAt).toLocaleString()} />
        <TimelineCard title="Verification history" items={details.recentVerification} render={(item) => item.action + (item.reason ? " · " + item.reason : "")} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputMode?: "numeric";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</span>
      <input
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-[#aaa0ff] focus:bg-white disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-black outline-none">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3">
      <span className="text-[10px] font-black">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={"rounded-lg px-2.5 py-1.5 text-[9px] font-black " + (value ? "bg-emerald-600 text-white" : "bg-white text-gray-500")}
      >
        {value ? "On" : "Off"}
      </button>
    </div>
  );
}

function TimelineCard({
  title,
  items,
  render,
}: {
  title: string;
  items: any[];
  render: (item: any) => string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black">{title}</p>
        <History size={14} className="text-gray-300" />
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 8).map((item) => (
          <div key={item.id} className="rounded-xl bg-gray-50 p-3">
            <p className="line-clamp-2 text-[10px] font-medium text-gray-600">{render(item)}</p>
            <p className="mt-1 text-[9px] text-gray-400">
              {new Date(item.createdAt ?? item.updatedAt).toLocaleString()}
            </p>
          </div>
        ))}
        {!items.length ? <p className="text-[10px] text-gray-400">No recent records.</p> : null}
      </div>
    </Card>
  );
}

function SafetyWorkspace({ onNotice }: { onNotice: (value: string) => void }) {
  const [tab, setTab] = useState<"reports" | "verification">("reports");
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Trust & safety"
        title="Safety center"
        icon={Shield}
        description="Moderation, assignment, priority, reviewer notes, enforcement actions, and verification requests are organized together without changing the underlying safety APIs."
      />
      <Card className="p-2">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => setTab("reports")}
            className={"rounded-2xl px-4 py-3 text-xs font-black " + (tab === "reports" ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50")}
          >
            Reports & enforcement
          </button>
          <button
            onClick={() => setTab("verification")}
            className={"rounded-2xl px-4 py-3 text-xs font-black " + (tab === "verification" ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50")}
          >
            Verification
          </button>
        </div>
      </Card>
      {tab === "reports" ? <ReportsPanel onNotice={onNotice} /> : <VerificationPanel onNotice={onNotice} />}
    </div>
  );
}

function ReportsPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [currentAdminId, setCurrentAdminId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const url = "/api/admin/reports?take=100" + (status ? "&status=" + status : "") + (query ? "&q=" + encodeURIComponent(query) : "");
      const response = await fetch(url, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load reports.");
      setReports(json.reports ?? []);
      setCounts(json.counts ?? {});
      setCurrentAdminId(json.currentAdminId ?? "");
      setNotes(Object.fromEntries((json.reports ?? []).map((report: ReportRow) => [report.id, report.moderatorNote ?? ""])));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status, query]);

  async function updateReport(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update report.");
      onNotice("Report updated and audited.");
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not update report.");
    } finally {
      setBusy(null);
    }
  }

  async function enforce(id: string, action: "DELETE_POST" | "DELETE_COMMENT" | "DISABLE_USER") {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Moderation action failed.");
      onNotice("Moderation action completed and audited.");
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Moderation action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          ["Pending", counts.pending ?? 0, "PENDING"],
          ["Reviewed", counts.reviewed ?? 0, "REVIEWED"],
          ["Resolved", counts.resolved ?? 0, "RESOLVED"],
          ["Dismissed", counts.dismissed ?? 0, "DISMISSED"],
        ].map(([label, value, key]) => (
          <button key={String(key)} type="button" onClick={() => setStatus(status === key ? "" : String(key))} className={"rounded-2xl border p-4 text-left " + (status === key ? "border-violet-200 bg-violet-50" : "border-gray-100 bg-white")}>
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-black">{String(value)}</p>
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search report reason, user or content" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs outline-none" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-black">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <button onClick={() => void load()} className="rounded-xl bg-gray-950 px-4 text-[10px] font-black text-white">Refresh</button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {reports.map((report) => (
            <div key={report.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={"rounded-full px-2 py-1 text-[9px] font-black " + priorityClass(report.priority)}>{report.priority}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black text-gray-600">{report.status}</span>
                      {report.assignedTo ? (
                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-600">Assigned: {report.assignedTo.name}</span>
                      ) : (
                        <span className="rounded-full bg-gray-50 px-2 py-1 text-[9px] font-black text-gray-400">Unassigned</span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-black">{report.reason}</h3>
                    <p className="mt-1 text-[10px] text-gray-400">Reporter: {report.reporter.name} · {new Date(report.createdAt).toLocaleString()}</p>
                    <div className="mt-3 rounded-2xl bg-gray-50 p-3">
                      <p className="line-clamp-3 text-xs leading-5 text-gray-600">
                        {report.post?.content ?? report.comment?.content ?? (report.reportedUser ? "Reported account" : "Report without linked content")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[150px_auto_1fr] lg:items-end">
                  <label>
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">Priority</span>
                    <select
                      value={report.priority}
                      onChange={(event) => void updateReport(report.id, { priority: event.target.value })}
                      className="h-9 w-full rounded-xl border border-gray-200 bg-white px-2 text-[9px] font-black"
                    >
                      <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <MiniAction
                      label={report.assignedTo?.id === currentAdminId ? "Unassign me" : "Assign to me"}
                      onClick={() => void updateReport(report.id, { assignedToId: report.assignedTo?.id === currentAdminId ? null : currentAdminId })}
                    />
                    {report.status !== "REVIEWED" ? <MiniAction label="Mark reviewed" onClick={() => void updateReport(report.id, { status: "REVIEWED" })} /> : null}
                    {report.status !== "RESOLVED" ? <MiniAction label="Resolve" onClick={() => void updateReport(report.id, { status: "RESOLVED" })} /> : null}
                    {report.status !== "DISMISSED" ? <MiniAction label="Dismiss" onClick={() => void updateReport(report.id, { status: "DISMISSED" })} /> : null}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={notes[report.id] ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                      placeholder="Moderator note"
                      maxLength={1000}
                      className="h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[10px] outline-none"
                    />
                    <MiniAction label="Save note" onClick={() => void updateReport(report.id, { note: notes[report.id] ?? "" })} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {report.post ? <MiniAction label="Delete post" danger={true} onClick={() => void enforce(report.id, "DELETE_POST")} /> : null}
                  {report.comment ? <MiniAction label="Delete comment" danger={true} onClick={() => void enforce(report.id, "DELETE_COMMENT")} /> : null}
                  {report.reportedUser ? <MiniAction label="Disable user" danger={true} onClick={() => void enforce(report.id, "DISABLE_USER")} /> : null}
                  {busy === report.id ? <span className="self-center text-[10px] font-black text-violet-600">Saving moderation action…</span> : null}
                </div>

                {report.moderatorNote ? (
                  <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] text-amber-800">
                    Saved note: {report.moderatorNote}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading reports…</p> : null}
          {!loading && !reports.length ? <p className="p-10 text-center text-xs text-gray-400">No reports match this view.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function priorityClass(priority: ReportRow["priority"]) {
  if (priority === "CRITICAL") return "bg-red-100 text-red-700";
  if (priority === "HIGH") return "bg-orange-100 text-orange-700";
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

function VerificationPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/verification-requests?status=" + status + "&take=100", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load verification requests.");
      setItems(json.requests ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load verification requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function review(requestId: string, action: "APPROVED" | "REJECTED", note?: string) {
    try {
      const response = await fetch("/api/admin/verification-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status: action,
          note: note?.trim() || undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not review verification request.");
      onNotice("Verification request reviewed and audited.");
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not review verification request.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 p-4">
        {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"].map((key) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={"rounded-xl px-3 py-2 text-[9px] font-black " + (status === key ? "bg-gray-950 text-white" : "bg-white text-gray-500")}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <VerificationRequestRow key={item.id} item={item} onReview={review} />
        ))}
        {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading verification requests…</p> : null}
        {!loading && !items.length ? <p className="p-10 text-center text-xs text-gray-400">No verification requests in this view.</p> : null}
      </div>
    </Card>
  );
}

function VerificationRequestRow({
  item,
  onReview,
}: {
  item: any;
  onReview: (requestId: string, action: "APPROVED" | "REJECTED", note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState(item.adminNote ?? "");

  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-600">
          <ShieldCheck size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black">{item.user?.name ?? "User"}</p>
          <p className="text-[10px] text-gray-400">@{item.user?.username ?? "member"} · {item.user?.email ?? ""}</p>
          <p className="mt-2 text-xs leading-5 text-gray-600">{item.reason ?? "No reason supplied."}</p>
          {item.adminNote ? <p className="mt-2 rounded-xl bg-gray-50 p-3 text-[10px] text-gray-500">Previous note: {item.adminNote}</p> : null}
          {item.status === "PENDING" ? (
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional reviewer note"
              className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] outline-none"
            />
          ) : null}
        </div>
        {item.status === "PENDING" ? (
          <div className="flex shrink-0 gap-2">
            <MiniAction label="Approve" onClick={() => void onReview(item.id, "APPROVED", note)} />
            <MiniAction label="Reject" danger={true} onClick={() => void onReview(item.id, "REJECTED", note)} />
          </div>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black">{item.status}</span>
        )}
      </div>
    </div>
  );
}

function ContentWorkspace({ onNotice }: { onNotice: (value: string) => void }) {
  const [tab, setTab] = useState<"posts" | "comments" | "stories">("posts");
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Content"
        title="Content management"
        icon={FileText}
        description="Moderate posts, comments, and stories from one workspace with visibility controls, metric overrides, and destructive-action safeguards."
      />
      <Card className="p-2">
        <div className="grid grid-cols-3 gap-1">
          {[
            ["posts", "Posts"],
            ["comments", "Comments"],
            ["stories", "Stories"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={"rounded-2xl px-3 py-3 text-[10px] font-black " + (tab === key ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50")}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>
      {tab === "posts" ? <PostsPanel onNotice={onNotice} /> : null}
      {tab === "comments" ? <CommentsPanel onNotice={onNotice} /> : null}
      {tab === "stories" ? <StoriesPanel onNotice={onNotice} /> : null}
    </div>
  );
}

function PostsPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ likes: "", comments: "", shares: "" });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/posts?take=100&q=" + encodeURIComponent(query), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load posts.");
      setPosts(json.posts ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load posts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  function beginMetrics(post: any) {
    const override = post.postMetricOverride;
    setEditingId(post.id);
    setDraft({
      likes: override?.likes == null ? "" : String(override.likes),
      comments: override?.comments == null ? "" : String(override.comments),
      shares: override?.shares == null ? "" : String(override.shares),
    });
  }

  async function update(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update post.");
      onNotice("Post updated and audited.");
      setEditingId(null);
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not update post.");
    } finally {
      setBusy(null);
    }
  }

  async function saveMetrics(id: string) {
    const parse = (value: string) => (value.trim() === "" ? null : Number(value));
    const metrics = {
      likes: parse(draft.likes),
      comments: parse(draft.comments),
      shares: parse(draft.shares),
    };
    if (Object.values(metrics).some((value) => value !== null && (!Number.isInteger(value) || value < 0))) {
      onNotice("Display metrics must be whole numbers greater than or equal to zero.");
      return;
    }
    await update(id, { metrics });
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not delete post.");
      onNotice("Post deleted and audited.");
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not delete post.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search post text or author" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs outline-none" />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {posts.map((post) => {
            const override = post.postMetricOverride;
            const editing = editingId === post.id;
            return (
              <div key={post.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black">{post.author.name}</span>
                      <span className="text-[10px] text-gray-400">@{post.author.username ?? "member"}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black">{post.visibility}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{post.content ?? "Media post"}</p>
                    <p className="mt-2 text-[10px] text-gray-400">
                      Live: {compact(post._count.likes)} likes · {compact(post._count.comments)} comments · {compact(post.shareCount)} shares
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-violet-600">
                      Public display: {compact(override?.likes ?? post._count.likes)} likes · {compact(override?.comments ?? post._count.comments)} comments · {compact(override?.shares ?? post.shareCount)} shares
                    </p>
                    {editing ? (
                      <div className="mt-3 grid gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 p-3 sm:grid-cols-3">
                        {(["likes", "comments", "shares"] as const).map((key) => (
                          <label key={key} className="block">
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-violet-600">{key}</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              value={draft[key]}
                              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                              placeholder={String(key === "likes" ? post._count.likes : key === "comments" ? post._count.comments : post.shareCount)}
                              className="h-9 w-full rounded-xl border border-violet-100 bg-white px-3 text-xs outline-none"
                            />
                          </label>
                        ))}
                        <div className="flex flex-wrap gap-2 sm:col-span-3">
                          <MiniAction label="Save display metrics" onClick={() => void saveMetrics(post.id)} />
                          <MiniAction label="Reset to live" onClick={() => void update(post.id, { metrics: { likes: null, comments: null, shares: null } })} />
                          <MiniAction label="Cancel" onClick={() => setEditingId(null)} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:w-64 lg:justify-end">
                    <select
                      value={post.visibility}
                      onChange={(event) => void update(post.id, { visibility: event.target.value })}
                      className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-[9px] font-black"
                    >
                      <option>PUBLIC</option>
                      <option>FRIENDS</option>
                      <option>PRIVATE</option>
                    </select>
                    {!editing ? <MiniAction label="Edit display metrics" onClick={() => beginMetrics(post)} /> : null}
                    <MiniAction label="Delete" danger={true} onClick={() => void remove(post.id)} />
                  </div>
                </div>
                {busy === post.id ? <p className="mt-3 text-[10px] font-black text-violet-600">Saving post change…</p> : null}
              </div>
            );
          })}
          {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading posts…</p> : null}
          {!loading && !posts.length ? <p className="p-10 text-center text-xs text-gray-400">No posts found.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function CommentsPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/comments?q=" + encodeURIComponent(query), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load comments.");
      setComments(json.comments ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load comments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function remove(id: string) {
    try {
      const response = await fetch("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not delete comment.");
      onNotice("Comment deleted and audited.");
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not delete comment.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 p-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search comments" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
      </div>
      <div className="divide-y divide-gray-100">
        {comments.map((comment) => (
          <div key={comment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">{comment.author.name} <span className="font-medium text-gray-400">@{comment.author.username ?? "member"}</span></p>
              <p className="mt-1 text-sm text-gray-700">{comment.content}</p>
              <p className="mt-1 text-[9px] text-gray-400">{comment._count.reports} reports · {comment._count.replies} replies · {new Date(comment.createdAt).toLocaleString()}</p>
            </div>
            <MiniAction label="Delete" danger={true} onClick={() => void remove(comment.id)} />
          </div>
        ))}
        {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading comments…</p> : null}
        {!loading && !comments.length ? <p className="p-10 text-center text-xs text-gray-400">No comments found.</p> : null}
      </div>
    </Card>
  );
}

function StoriesPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/stories?q=" + encodeURIComponent(query), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load stories.");
      setStories(json.stories ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load stories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function remove(storyId: string) {
    try {
      const response = await fetch("/api/admin/stories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not delete story.");
      onNotice("Story deleted and audited.");
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not delete story.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 p-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search story author or caption" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
      </div>
      <div className="divide-y divide-gray-100">
        {stories.map((story) => (
          <div key={story.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gray-100 text-[9px] font-black text-gray-500">
              STORY
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">{story.author.name} <span className="font-medium text-gray-400">@{story.author.username ?? "member"}</span></p>
              <p className="mt-1 text-sm text-gray-700">{story.caption ?? "No caption"}</p>
              <p className="mt-1 text-[9px] text-gray-400">{story._count.views} views · {story._count.replies} replies · {story._count.reactions} reactions</p>
            </div>
            <MiniAction label="Delete story" danger={true} onClick={() => void remove(story.id)} />
          </div>
        ))}
        {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading stories…</p> : null}
        {!loading && !stories.length ? <p className="p-10 text-center text-xs text-gray-400">No stories found.</p> : null}
      </div>
    </Card>
  );
}

function MessagingWorkspace({ onNotice }: { onNotice: (value: string) => void }) {
  const [tab, setTab] = useState<"conversations" | "activity">("conversations");
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Messaging & investigation"
        title="Messaging review"
        icon={MessageSquare}
        description="Read authorized conversations and inspect user activity using the existing audited admin inspection APIs."
      />
      <Card className="p-2">
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => setTab("conversations")} className={"rounded-2xl px-4 py-3 text-xs font-black " + (tab === "conversations" ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50")}>Conversations</button>
          <button onClick={() => setTab("activity")} className={"rounded-2xl px-4 py-3 text-xs font-black " + (tab === "activity" ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50")}>User activity</button>
        </div>
      </Card>
      {tab === "conversations" ? <ConversationsPanel onNotice={onNotice} /> : <ActivityPanel onNotice={onNotice} />}
    </div>
  );
}

function ConversationsPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/messages?q=" + encodeURIComponent(query), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load conversations.");
      setConversations(json.conversations ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function openConversation(id: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/messages?conversationId=" + encodeURIComponent(id), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not open conversation.");
      setSelected(json.conversation);
      setMessages(json.messages ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not open conversation.");
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-xs font-black text-gray-500">
          <ArrowLeft size={14} />
          Back to conversations
        </button>
        <Card className="p-5">
          <p className="text-sm font-black">{selected.title ?? selected.members?.map((member: any) => member.user.name).join(" · ")}</p>
          <p className="mt-1 text-[10px] text-gray-400">Admin access is recorded in the audit log.</p>
        </Card>
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-100">
            {messages.map((message) => (
              <div key={message.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black">{message.sender.name} <span className="font-medium text-gray-400">@{message.sender.username ?? "member"}</span></p>
                  <span className="text-[9px] text-gray-400">{new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <p className={"mt-2 whitespace-pre-wrap text-sm leading-6 " + (message.deletedAt ? "italic text-gray-400" : "text-gray-700")}>
                  {message.deletedAt ? "Message deleted" : message.content}
                </p>
              </div>
            ))}
            {!messages.length ? <p className="p-10 text-center text-xs text-gray-400">No messages in this conversation.</p> : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 p-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user or email" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
      </div>
      <div className="divide-y divide-gray-100">
        {conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => void openConversation(conversation.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-gray-50">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">
              {initials(conversation.members?.map((member: any) => member.user.name).join(" ") ?? "M")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black">{conversation.title ?? conversation.members?.map((member: any) => member.user.name).join(" · ")}</span>
              <span className="mt-1 block truncate text-[10px] text-gray-400">{conversation.messages?.[0]?.content ?? "No messages yet"}</span>
            </span>
            <ChevronRight size={14} className="text-gray-300" />
          </button>
        ))}
        {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading conversations…</p> : null}
        {!loading && !conversations.length ? <p className="p-10 text-center text-xs text-gray-400">No conversations found.</p> : null}
      </div>
    </Card>
  );
}

function ActivityPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [activity, setActivity] = useState<any | null>(null);

  async function findUsers() {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const response = await fetch("/api/admin/users?take=8&q=" + encodeURIComponent(query), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not search users.");
      setResults(json.users ?? []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not search users.");
    }
  }

  async function loadActivity(userId: string) {
    try {
      const response = await fetch("/api/admin/activity?userId=" + encodeURIComponent(userId), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load user activity.");
      setActivity(json);
      setResults([]);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load user activity.");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void findUsers(); }} placeholder="Search user for activity review" className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
          <button onClick={() => void findUsers()} className="rounded-xl bg-gray-950 px-4 text-[10px] font-black text-white">Find</button>
        </div>
        {results.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {results.map((user) => (
              <button key={user.id} onClick={() => void loadActivity(user.id)} className="rounded-2xl bg-gray-50 p-3 text-left hover:bg-gray-100">
                <p className="text-xs font-black">{user.name}</p>
                <p className="mt-1 text-[10px] text-gray-400">@{user.username ?? "member"} · {user.email}</p>
              </button>
            ))}
          </div>
        ) : null}
      </Card>
      {activity ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Posts", activity.posts?.length ?? 0],
            ["Comments", activity.comments?.length ?? 0],
            ["Likes", activity.likes?.length ?? 0],
            ["Notifications", activity.notifications?.length ?? 0],
          ].map(([label, value]) => <MetricCard key={String(label)} label={String(label)} value={compact(Number(value))} icon={Activity} />)}
        </div>
      ) : null}
      {activity ? (
        <Card className="p-5">
          <p className="text-sm font-black">Recent user activity</p>
          <div className="mt-3 space-y-2">
            {[
              ["Posts", activity.posts],
              ["Comments", activity.comments],
              ["Likes", activity.likes],
              ["Follows", activity.follows],
              ["Friend requests", activity.friends],
              ["Stories", activity.stories],
              ["Sessions", activity.sessions],
            ].flatMap(([label, items]) =>
              (items as any[]).slice(0, 8).map((item, index) => (
                <div key={String(label) + index} className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-600">{String(label)}</span>
                    <span className="text-[9px] text-gray-400">{new Date(item.createdAt ?? item.updatedAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.content ?? item.type ?? item.status ?? "Activity recorded"}</p>
                </div>
              )),
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center text-xs text-gray-400">Search for a user to open their activity timeline.</Card>
      )}
    </div>
  );
}

function InsightsWorkspace({ dashboard, onRefresh }: { dashboard: any; onRefresh: () => void }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/analytics", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load analytics.");
      setAnalytics(json);
    } catch {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const series = analytics?.series ?? {};
  const totals = Object.fromEntries(
    Object.entries(series).map(([key, rows]: [string, any]) => [key, (rows ?? []).reduce((sum: number, row: any) => sum + Number(row.count ?? 0), 0)]),
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Insights"
        title="Product & safety analytics"
        icon={BarChart3}
        description="Live database-backed activity series, separated from public display metric overrides."
        onRefresh={() => { void load(); onRefresh(); }}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["New members", totals.users ?? 0, Users],
          ["New posts", totals.posts ?? 0, FileText],
          ["Messages", totals.messages ?? 0, MessageSquare],
          ["Reports", totals.reports ?? 0, Shield],
          ["Profile views", totals.profileViews ?? 0, UserRound],
        ].map(([label, value, Icon]) => (
          <MetricCard key={String(label)} label={String(label)} value={compact(Number(value))} icon={Icon as React.ElementType} />
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black">30-day activity</p>
            <p className="mt-1 text-[10px] text-gray-400">Each bar represents one day; values are raw database event counts.</p>
          </div>
          <Activity size={16} className="text-[#5a4be8]" />
        </div>
        <div className="mt-5 grid gap-4">
          {["users", "posts", "messages", "reports", "profileViews"].map((key) => {
            const rows = series[key] ?? [];
            const max = Math.max(1, ...rows.map((row: any) => Number(row.count ?? 0)));
            return (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{key.replace(/([A-Z])/g, " $1")}</p>
                  <p className="text-[10px] font-black text-gray-500">{compact(rows.reduce((sum: number, row: any) => sum + Number(row.count ?? 0), 0))}</p>
                </div>
                <div className="flex h-14 items-end gap-1 overflow-hidden rounded-xl bg-gray-50 p-2">
                  {rows.slice(-30).map((row: any, index: number) => (
                    <span
                      key={index}
                      title={new Date(row.day).toLocaleDateString() + ": " + row.count}
                      className="min-w-[5px] flex-1 rounded-t-md bg-[#6d5dfc]/75"
                      style={{ height: Math.max(8, (Number(row.count ?? 0) / max) * 100) + "%" }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {loading ? <p className="mt-3 text-xs text-gray-400">Refreshing analytics…</p> : null}
      </Card>
      <Card className="p-5">
        <p className="text-xs font-black">Current platform totals</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Members", dashboard?.stats?.users],
            ["Active members", dashboard?.stats?.activeUsers],
            ["Posts", dashboard?.stats?.posts],
            ["Messages", dashboard?.stats?.messages],
            ["Reports", dashboard?.stats?.pendingReports],
            ["Verification queue", dashboard?.stats?.pendingVerificationRequests],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">{String(label)}</p>
              <p className="mt-1 text-lg font-black">{compact(Number(value ?? 0))}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AuditWorkspace({ onNotice }: { onNotice: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [targetType, setTargetType] = useState("");
  const [action, setAction] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextBefore?: string | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ take: "60" });
      if (query) params.set("q", query);
      if (targetType) params.set("targetType", targetType);
      if (action) params.set("action", action);
      if (nextBefore) params.set("before", nextBefore);
      const response = await fetch("/api/admin/audit?" + params.toString(), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load audit logs.");
      const combined = [...(json.logs ?? []), ...(json.events ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLogs(nextBefore ? [...logs, ...combined] : combined);
      setBefore(json.nextBefore ?? null);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(null);
  }, [query, targetType, action]);

  function exportCsv() {
    const params = new URLSearchParams({ format: "csv", take: "1000" });
    if (query) params.set("q", query);
    if (targetType) params.set("targetType", targetType);
    if (action) params.set("action", action);
    window.open("/api/admin/audit?" + params.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Audit"
        title="Audit explorer"
        icon={History}
        description="Search privileged actions by action, target type, target id, or structured details. CSV export remains permission-gated by the existing API."
        onRefresh={() => void load(null)}
      />
      <Card className="p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit details" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
          <input value={targetType} onChange={(event) => setTargetType(event.target.value)} placeholder="Target type" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
          <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none" />
          <button onClick={exportCsv} className="rounded-xl bg-gray-950 px-4 text-[10px] font-black text-white">Export CSV</button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {logs.map((log) => (
            <div key={log.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-600">{log.action}</span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black text-gray-600">{log.targetType}</span>
                {log.targetId ? <span className="text-[9px] text-gray-400">{log.targetId}</span> : null}
                <span className="ml-auto text-[9px] text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              {log.details ? (
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-[9px] leading-4 text-gray-500">
                  {log.details}
                </pre>
              ) : null}
            </div>
          ))}
          {loading ? <p className="p-10 text-center text-xs text-gray-400">Loading audit log…</p> : null}
          {!loading && !logs.length ? <p className="p-10 text-center text-xs text-gray-400">No audit entries match this filter.</p> : null}
        </div>
        {before ? (
          <div className="border-t border-gray-100 p-4 text-center">
            <button onClick={() => void load(before)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-black">Load older entries</button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function LegacyPanel() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="mb-4 text-xs font-black">Compatibility surface</p>
      <p className="mb-4 text-[10px] leading-5 text-gray-500">
        The previous admin implementation remains reachable here so established operations have a safe rollback path while the reorganized workspace is used by default.
      </p>
      <LegacyAdminPanel section="overview" />
    </div>
  );
}
