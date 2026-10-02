"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, BarChart3, Check, Eye, FileText, Gauge, History, Search, Shield,
  ShieldCheck, Trash2, UserRound, Users, X,
} from "lucide-react";
import { AdminInspection } from "@/components/admin-inspection";
import { AdminControlCenter } from "@/components/admin-control-center";
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
  post: { id: string; content: string | null; mediaUrl: string | null; authorId: string } | null;
  comment: { id: string; content: string; authorId: string; postId: string } | null;
};

type PostRow = {
  id: string; content: string | null; mediaUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "PRIVATE"; createdAt: string;
  author: { id: string; name: string; username: string | null; image: string | null };
  _count: { likes: number; comments: number; reports: number };
};

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={"rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(31,26,64,0.05)] " + className}>{children}</section>;
}
function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return <Card><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-2xl bg-[#f1efff] text-[#5a4be8]"><Icon size={17}/></span><span className="text-2xl font-black tracking-tight">{value}</span></div><p className="mt-4 text-xs font-bold text-gray-400">{label}</p></Card>;
}

export function AdminPanel({ section = "overview" }: { section?: string }) {
  const normalize = (value: string) => value === "engagement" ? "analytics" : value === "inspection" ? "user360" : value || "overview";
  const [active, setActive] = useState(normalize(section));
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [trustFilter, setTrustFilter] = useState<"all" | "verified" | "unverified" | "owner">("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [usersBefore, setUsersBefore] = useState<string | null>(null);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);

  useEffect(() => setActive(normalize(section)), [section]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setMessage("");
      try {
        if (active === "overview" || active === "analytics" || active === "audit") {
          const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
          const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Could not load admin dashboard.");
          if (!cancelled) setDashboard(json);
        }
        if (active === "users") {
          const response = await fetch("/api/admin/users?take=50&q=" + encodeURIComponent(query) + "&trust=" + trustFilter, { cache: "no-store" });
          const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Could not load users.");
          if (!cancelled) { setUsers(json.users ?? []); setUsersBefore(json.nextBefore ?? null); }
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load admin data."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [active, query, trustFilter]);

  async function loadMoreUsers() {
    if (!usersBefore || loadingMoreUsers) return;
    setLoadingMoreUsers(true);
    try {
      const response = await fetch("/api/admin/users?take=50&q=" + encodeURIComponent(query) + "&trust=" + trustFilter + "&before=" + encodeURIComponent(usersBefore), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load more users.");
      setUsers((items) => [...items, ...(json.users ?? [])]);
      setUsersBefore(json.nextBefore ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load more users.");
    } finally {
      setLoadingMoreUsers(false);
    }
  }

  async function openUser(id: string) {
    setSelectedId(id); setMessage("");
    try {
      const response = await fetch("/api/admin/users/" + id, { cache: "no-store" });
      const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Could not load user.");
      setSelected(json.user as UserRow);
      setSelectedDetails(json);
    } catch (error) { setSelectedId(""); setSelected(null); setSelectedDetails(null); setMessage(error instanceof Error ? error.message : "Could not load user."); }
  }

  async function saveUser(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setMessage("");
    const response = await fetch("/api/admin/users/" + selectedId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await response.json();
    if (!response.ok) { setMessage(json.error ?? "Could not update user."); return; }
    setSelected((current) => current ? { ...current, ...json.user } : current);
    setSelectedDetails((current: any) => current ? {
      ...current,
      override: json.override ?? (patch.metrics !== undefined ? null : current.override),
    } : current);
    setUsers((items) => items.map((item) => item.id === selectedId ? { ...item, ...json.user } : item));
    setMessage(patch.metrics !== undefined ? "Profile metrics updated and audited." : "User updated.");
  }

  const nav = [
    ["overview", "Dashboard", BarChart3], ["moderation", "Moderation", Shield], ["verification", "Verification", ShieldCheck], ["users", "Users", Users],
    ["user360", "User 360", UserRound], ["content", "Content", FileText], ["analytics", "Analytics", Activity], ["audit", "Audit logs", History],
  ] as const;

  const stats = dashboard?.stats ?? {};
  return (
    <main className="min-h-screen bg-[#f8f8fc] pb-10">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[30px] bg-gray-950 p-5 text-white shadow-[0_20px_60px_rgba(15,15,25,0.15)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-300">Socialhub Admin</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Control center</h1><p className="mt-2 max-w-2xl text-sm text-white/55">Operate the platform through real users, real reports, real content and auditable actions.</p></div><div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs font-bold"><span className="size-2 rounded-full bg-emerald-400"/> Protected admin controls</div></div>
        </header>
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-3xl border border-gray-100 bg-white p-2 shadow-[0_10px_35px_rgba(31,26,64,0.05)]">
            {nav.map(([key, label, Icon]) => <button key={key} onClick={() => { setActive(key); setSelectedId(""); setSelected(null); setMessage(""); }} className={"flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-xs font-black transition " + (active === key ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500 hover:bg-gray-50")}><Icon size={16}/>{label}</button>)}
          </aside>
          <section className="min-w-0 space-y-5">
            {message ? <div role="status" className="rounded-2xl border border-[#ddd8ff] bg-[#f8f7ff] px-4 py-3 text-xs font-bold text-[#5a4be8]">{message}</div> : null}
            {active === "overview" ? <Dashboard dashboard={dashboard} loading={loading}/> : null}
            {active === "analytics" ? <Analytics dashboard={dashboard} loading={loading}/> : null}
            {active === "audit" ? <Audit/> : null}
            {active === "control" ? <AdminControlCenter/> : null}
            {active === "moderation" ? <ModerationQueue onMessage={setMessage}/> : null}
            {active === "verification" ? <VerificationQueue onMessage={setMessage}/> : null}
            {active === "content" ? <ContentManager onMessage={setMessage}/> : null}
            {active === "user360" ? <AdminInspection/> : null}
            {active === "users" && !selectedId ? <><Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black">User management</h2><p className="mt-1 text-xs text-gray-400">Search, inspect and manage real Socialhub accounts.</p></div><div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username or email" className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#a79dff] sm:w-72"/></div><select value={trustFilter} onChange={(e) => { setTrustFilter(e.target.value as typeof trustFilter); setUsersBefore(null); }} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-black text-gray-600 outline-none"><option value="all">All trust states</option><option value="verified">Blue tick</option><option value="unverified">Standard</option><option value="owner">Owner</option></select></div></div></Card><Card className="!p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[.12em] text-gray-400"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Trust</th><th className="px-5 py-3">Posts</th><th className="px-5 py-3">Followers</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading users…</td></tr> : users.map((user) => <tr key={user.id} className="border-t border-gray-100"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">{initials(user.name)}</span><div><p className="font-black">{user.name}</p><p className="mt-0.5 text-[11px] text-gray-400">@{user.username ?? "member"} · {user.email}</p></div></div></td><td className="px-5 py-4"><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-600">{user.role}</span></td><td className="px-5 py-4"><AccountBadge verified={user.isVerified} owner={user.isOwner} showLabel size="md"/></td><td className="px-5 py-4 text-gray-500">{user._count.posts}</td><td className="px-5 py-4 text-gray-500">{user._count.followers}</td><td className="px-5 py-4">{user.isActive ? <span className="text-emerald-600">Active</span> : <span className="text-red-600">Disabled</span>}</td><td className="px-5 py-4"><button onClick={() => void openUser(user.id)} className="rounded-xl bg-gray-950 px-3 py-2 text-[10px] font-black text-white">Open</button></td></tr>)}{!loading && users.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-xs text-gray-400">No users match this search.</td></tr> : null}</tbody></table></div>{usersBefore ? <div className="border-t border-gray-100 p-4 text-center"><button type="button" onClick={() => void loadMoreUsers()} disabled={loadingMoreUsers} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[11px] font-black text-gray-700 disabled:opacity-40">{loadingMoreUsers ? "Loading…" : "Load more users"}</button></div> : null}</Card></> : null}
            {active === "users" && selectedId && selected ? <UserEditor user={selected} details={selectedDetails} onBack={() => { setSelectedId(""); setSelected(null); setSelectedDetails(null); }} onSaveUser={saveUser}/> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function Dashboard({ dashboard, loading }: { dashboard: any; loading: boolean }) {
  if (loading && !dashboard) return <Card><p className="text-xs text-gray-400">Loading dashboard…</p></Card>;
  const s = dashboard?.stats ?? {};
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total members" value={s.users ?? 0} icon={Users}/><Stat label="Active members" value={s.activeUsers ?? 0} icon={Activity}/><Stat label="Total posts" value={s.posts ?? 0} icon={FileText}/><Stat label="Total likes" value={s.likes ?? 0} icon={Gauge}/><Stat label="Comments" value={s.comments ?? 0} icon={Eye}/><Stat label="Followers" value={s.follows ?? 0} icon={Users}/><Stat label="Messages" value={s.messages ?? 0} icon={Activity}/><Stat label="Verified accounts" value={s.verifiedUsers ?? 0} icon={ShieldCheck}/><Stat label="Owner accounts" value={s.ownerUsers ?? 0} icon={Users}/><Stat label="Verification queue" value={s.pendingVerificationRequests ?? 0} icon={Check}/><Stat label="Pending reports" value={s.pendingReports ?? 0} icon={Shield}/></div><div className="grid gap-5 xl:grid-cols-2"><Card><h2 className="text-sm font-black">Newest members</h2><div className="mt-4 space-y-2">{(dashboard?.recentUsers ?? []).map((u: any) => <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"><span className="grid size-9 place-items-center rounded-full bg-violet-100 text-[10px] font-black text-violet-600">{initials(u.name)}</span><div className="flex-1"><p className="text-xs font-black">{u.name}</p><p className="text-[11px] text-gray-400">@{u.username ?? "member"}</p></div><span className="text-[10px] font-bold text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</span></div>)}</div></Card><Card><h2 className="text-sm font-black">Recent content</h2><div className="mt-4 space-y-2">{(dashboard?.recentPosts ?? []).map((p: any) => <div key={p.id} className="rounded-2xl bg-gray-50 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-black">{p.author.name}</p><span className="text-[10px] text-gray-400">{p._count.likes} likes · {p._count.comments} comments</span></div><p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{p.content ?? "Media post"}</p></div>)}</div></Card></div></>;
}

function Analytics({ dashboard, loading }: { dashboard: any; loading: boolean }) { if (loading && !dashboard) return <Card><p className="text-xs text-gray-400">Loading analytics…</p></Card>; const s=dashboard?.stats??{}; return <div className="space-y-5"><Card><h2 className="text-sm font-black">Platform analytics</h2><p className="mt-1 text-xs text-gray-400">These figures come from live database aggregates. They are not synthetic engagement values.</p></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Members" value={s.users??0} icon={Users}/><Stat label="Posts" value={s.posts??0} icon={FileText}/><Stat label="Comments" value={s.comments??0} icon={Eye}/><Stat label="Messages" value={s.messages??0} icon={Activity}/></div></div>; }

function UserEditor({ user, details, onBack, onSaveUser }: { user: UserRow; details: any; onBack:()=>void; onSaveUser:(patch:Record<string,unknown>)=>Promise<void>|void }) {
  const [saving,setSaving]=useState(false);
  async function save(patch:Record<string,unknown>){setSaving(true);try{await onSaveUser(patch)}finally{setSaving(false)}}
  const counts=details?.user?._count??{}, reports=details?.recentReports??[], audits=details?.recentAudit??[], sessions=details?.recentSessions??[], verification=details?.recentVerification??[];
  const formatDate=(value:string)=>new Date(value).toLocaleString();
  return <div className="space-y-5">
    <button onClick={onBack} className="text-xs font-black text-gray-500 hover:text-gray-950">← Back to users</button>
    <Card><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-lg font-black text-white">{initials(user.name)}</span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{user.name}</h2><AccountBadge verified={user.isVerified} owner={user.isOwner} showLabel size="sm"/></div><p className="text-xs text-gray-400">@{user.username??"member"} · {user.email}</p><p className="mt-1 text-[10px] text-gray-400">Joined {formatDate(user.createdAt)}</p></div><span className={"rounded-full px-3 py-1.5 text-[10px] font-black "+(user.isActive?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-600")}>{user.isActive?"ACTIVE":"DISABLED"}</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MiniSignal label="Privacy" value={user.isPrivate?"Private":"Public"}/><MiniSignal label="Email" value={user.emailVerified?"Verified":"Unverified"}/><MiniSignal label="Role" value={user.role}/><MiniSignal label="Verification" value={user.isOwner?"Owner":user.isVerified?"Verified":"Standard"}/><MiniSignal label="Website" value={details?.user?.website||"Not set"}/></div>
    </Card>
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"><Stat label="Posts" value={counts.posts??0} icon={FileText}/><Stat label="Likes" value={counts.likes??0} icon={Activity}/><Stat label="Comments" value={counts.comments??0} icon={Eye}/><Stat label="Followers" value={counts.followers??0} icon={Users}/><Stat label="Following" value={counts.following??0} icon={Users}/><Stat label="Reports filed" value={counts.filedReports??0} icon={Shield}/><Stat label="Reported in" value={counts.reportedIn??0} icon={ShieldCheck}/></div>
    <Card><div className="grid gap-4 sm:grid-cols-2"><Field label="Display name" value={user.name} onSave={(value)=>void save({name:value})}/><Field label="Username" value={user.username??""} onSave={(value)=>void save({username:value||null})}/></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button disabled={saving || user.isOwner} onClick={()=>void save({isActive:!user.isActive})} className={"rounded-2xl px-4 py-3 text-xs font-black "+(user.isActive?"bg-red-50 text-red-600":"bg-emerald-50 text-emerald-600")}>{user.isActive?"Disable account":"Activate account"}</button><select value={user.role} disabled={saving || user.isOwner} onChange={(e)=>void save({role:e.target.value})} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-black"><option value="USER">USER</option><option value="MODERATOR">MODERATOR</option><option value="ADMIN">ADMIN</option></select></div>{user.isOwner?<p className="mt-3 text-[10px] font-bold text-amber-700">Owner account role and activation are protected from this panel.</p>:null}</Card>
    <MetricControlCard details={details} saving={saving} onSave={(metrics)=>void save({metrics})}/>
    <Card><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-black">Account trust</h3><p className="mt-1 text-xs text-gray-400">Manage the public blue verification badge. Owner status is separate and protected.</p></div><AccountBadge verified={user.isVerified} owner={user.isOwner} showLabel size="md"/></div><div className="mt-4 flex flex-wrap gap-3"><button disabled={saving || user.isOwner} onClick={()=>void save({isVerified:!user.isVerified})} className={"rounded-2xl px-4 py-3 text-xs font-black "+(user.isVerified?"bg-red-50 text-red-600":"bg-blue-50 text-blue-700")}>{user.isVerified?"Remove blue tick":"Give blue tick"}</button>{user.isOwner?<span className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-black text-amber-700">Owner badge is protected</span>:null}</div></Card>
    <Card>
      <div><h3 className="text-sm font-black">Account controls</h3><p className="mt-1 text-xs text-gray-400">Operational controls for privacy and email verification. Existing server-side owner and role protections remain active.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button disabled={saving || user.isOwner} onClick={()=>void save({isPrivate:!user.isPrivate})} className={"rounded-2xl px-4 py-3 text-xs font-black "+(user.isPrivate?"bg-amber-50 text-amber-700":"bg-gray-950 text-white")}>{user.isPrivate?"Make profile public":"Make profile private"}</button>
        <button disabled={saving || user.isOwner} onClick={()=>void save({emailVerified:!user.emailVerified})} className={"rounded-2xl px-4 py-3 text-xs font-black "+(user.emailVerified?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700")}>{user.emailVerified?"Mark email unverified":"Mark email verified"}</button>
      </div>
    </Card>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Account activity</h3><p className="mt-1 text-xs text-gray-400">Recent reports involving this account.</p></div><Shield size={17} className="text-gray-300"/></div><div className="mt-4 divide-y divide-gray-100">{reports.length?reports.map((report:any)=><div key={report.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black">{report.reason}</p><span className="text-[10px] font-black text-gray-400">{report.status}</span></div><p className="mt-1 text-[10px] text-gray-400">{formatDate(report.createdAt)} · {report.reportedUserId===user.id?"reported this account":"filed this report"}</p></div>):<p className="py-6 text-xs text-gray-400">No recent reports.</p>}</div></Card>
      <Card><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Admin history</h3><p className="mt-1 text-xs text-gray-400">Recent audited actions targeting this user.</p></div><History size={17} className="text-gray-300"/></div><div className="mt-4 divide-y divide-gray-100">{audits.length?audits.map((log:any)=><div key={log.id} className="py-3"><p className="text-xs font-black">{log.action}</p><p className="mt-1 text-[10px] text-gray-400">{formatDate(log.createdAt)} · Admin {log.adminId}</p></div>):<p className="py-6 text-xs text-gray-400">No recent admin actions.</p>}</div></Card>
    </div>
    <Card><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Verification history</h3><p className="mt-1 text-xs text-gray-400">Every blue-tick change is recorded.</p></div><ShieldCheck size={17} className="text-gray-300"/></div><div className="mt-4 divide-y divide-gray-100">{verification.length?verification.map((item:any)=><div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-black">{String(item.action).replaceAll("_"," ")}</p><p className="mt-1 text-[10px] text-gray-400">{formatDate(item.createdAt)} · Admin {item.adminId}</p></div>{item.reason?<span className="max-w-[55%] text-right text-[10px] text-gray-400">{item.reason}</span>:null}</div>):<p className="py-6 text-xs text-gray-400">No verification changes.</p>}</div></Card>
    <Card><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Recent sessions</h3><p className="mt-1 text-xs text-gray-400">Latest session metadata available to administrators.</p></div><ShieldCheck size={17} className="text-gray-300"/></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-[10px] font-black uppercase tracking-[.12em] text-gray-400"><tr><th className="pb-2 pr-4">Last updated</th><th className="pb-2 pr-4">IP</th><th className="pb-2">User agent</th></tr></thead><tbody>{sessions.length?sessions.map((session:any)=><tr key={session.id} className="border-t border-gray-100"><td className="py-3 pr-4 font-bold text-gray-600">{formatDate(session.updatedAt)}</td><td className="py-3 pr-4 text-gray-500">{session.ipAddress||"Unavailable"}</td><td className="max-w-[420px] truncate py-3 text-gray-500">{session.userAgent||"Unavailable"}</td></tr>):<tr><td colSpan={3} className="py-6 text-xs text-gray-400">No recent sessions.</td></tr>}</tbody></table></div></Card>
  </div>;
}
function MetricControlCard({details,saving,onSave}:{details:any;saving:boolean;onSave:(metrics:Record<string,number|null>)=>void}) {
  const actual=details?.actualMetrics ?? {};
  const override=details?.override ?? {};
  const canEditMetrics=details?.canEditMetrics !== false;
  const fields=[
    ["posts","Posts"],["followers","Followers"],["following","Following"],
    ["likesReceived","Likes received"],["commentsReceived","Comments received"],
    ["shares","Shares"],["profileViews","Profile views"],
  ] as const;
  const [draft,setDraft]=useState<Record<string,string>>({});
  useEffect(()=>{
    const next:Record<string,string>={};
    for(const [key] of fields) next[key]=override[key] == null ? "" : String(override[key]);
    setDraft(next);
  },[details?.override?.id, details?.override?.updatedAt]);
  function update(key:string,value:string){setDraft(current=>({...current,[key]:value.replace(/[^0-9]/g,"").slice(0,10)}))}
  function save(){
    const metrics:Record<string,number|null>={};
    for(const [key] of fields) metrics[key]=draft[key]==="" ? null : Number(draft[key]);
    onSave(metrics);
  }
  function reset(){onSave(Object.fromEntries(fields.map(([key])=>[key,null])))}
  return <Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="text-sm font-black">Profile metrics control</h3><p className="mt-1 text-xs text-gray-400">Set public profile counters without changing real relationship, post, like or comment records. Blank values use live database totals.</p></div>
      <span className={"rounded-full px-3 py-1.5 text-[10px] font-black "+(canEditMetrics?"bg-violet-50 text-violet-700":"bg-gray-100 text-gray-500")}>{canEditMetrics?"Admin only":"View only"}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map(([key,label])=><div key={key} className="rounded-2xl bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black uppercase tracking-[.1em] text-gray-400">{label}</label><span className="text-[10px] font-bold text-gray-400">Live {actual[key] ?? 0}</span></div>
        <input inputMode="numeric" value={draft[key] ?? ""} onChange={e=>update(key,e.target.value)} placeholder={String(actual[key] ?? 0)} disabled={saving || !canEditMetrics} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#a79dff]" />
        <p className="mt-1 text-[9px] text-gray-400">{override[key] == null ? "Using live value" : "Override active"}</p>
      </div>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={saving || !canEditMetrics} onClick={save} className="rounded-xl bg-gray-950 px-4 py-2.5 text-[10px] font-black text-white disabled:opacity-50">Save metrics</button>
      <button type="button" disabled={saving || !canEditMetrics} onClick={reset} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-black text-gray-700 disabled:opacity-50">Reset all to live</button>
    </div>
  </Card>;
}

function MiniSignal({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-gray-400">{label}</p><p className="mt-1 truncate text-xs font-black text-gray-700">{value}</p></div>}
function Field({label,value,onSave}:{label:string;value:string;onSave:(value:string)=>void}){const[draft,setDraft]=useState(value);const[editing,setEditing]=useState(false);return <div className="rounded-2xl bg-gray-50 p-4"><label className="text-[11px] font-black text-gray-500">{label}</label>{editing?<div className="mt-2 flex gap-2"><input value={draft} onChange={e=>setDraft(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"/><button onClick={()=>{onSave(draft);setEditing(false)}} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white"><Check size={14}/></button><button onClick={()=>setEditing(false)} className="grid size-9 place-items-center rounded-xl bg-white text-gray-500"><X size={14}/></button></div>:<button onClick={()=>{setDraft(value);setEditing(true)}} className="mt-2 flex w-full items-center justify-between text-left text-sm font-black">{value||"Not set"}<span className="text-[10px] text-gray-400">Edit</span></button>}</div>}

function VerificationQueue({onMessage}:{onMessage:(value:string)=>void}) {
  const [status,setStatus]=useState<"PENDING"|"APPROVED"|"REJECTED"|"ALL">("PENDING");
  const [requests,setRequests]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");

  async function load() {
    setLoading(true);
    try {
      const response=await fetch("/api/admin/verification-requests?status="+status,{cache:"no-store"});
      const json=await response.json();
      if(!response.ok) throw new Error(json.error??"Could not load verification requests.");
      setRequests(json.requests??[]);
    } catch(error) { onMessage(error instanceof Error?error.message:"Could not load verification requests."); }
    finally { setLoading(false); }
  }

  useEffect(()=>{void load()},[status]);

  async function review(requestId:string, nextStatus:"APPROVED"|"REJECTED") {
    if(busy) return;
    const note=nextStatus==="REJECTED" ? window.prompt("Optional reason for rejecting this verification request:") ?? "" : "";
    if(nextStatus==="APPROVED" && !window.confirm("Approve this verification request and give the blue tick?")) return;
    setBusy(requestId);
    try {
      const response=await fetch("/api/admin/verification-requests",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,status:nextStatus,note:note.trim()||undefined})});
      const json=await response.json();
      if(!response.ok) throw new Error(json.error??"Could not review verification request.");
      setRequests((items)=>items.filter((item)=>item.id!==requestId));
      onMessage(nextStatus==="APPROVED"?"Verification approved and blue tick granted.":"Verification request rejected.");
    } catch(error) { onMessage(error instanceof Error?error.message:"Could not review verification request."); }
    finally { setBusy(""); }
  }

  return <div className="space-y-5">
    <Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black">Verification requests</h2><p className="mt-1 text-xs text-gray-400">Review user-submitted requests without changing owner status.</p></div><select value={status} onChange={(e)=>setStatus(e.target.value as typeof status)} className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-black text-gray-600 outline-none"><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select></div></Card>
    <div className="space-y-3">{loading?<Card><p className="text-xs text-gray-400">Loading verification requests…</p></Card>:requests.length?requests.map((item)=><Card key={item.id}><div className="flex flex-col gap-4"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">{initials(item.user.name)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{item.user.name}</p><AccountBadge verified={item.user.isVerified} owner={item.user.isOwner} size="sm"/><span className="text-[10px] text-gray-400">@{item.user.username??"member"}</span></div><p className="mt-1 text-[10px] text-gray-400">{item.user.email} · {new Date(item.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-700">{item.status}</span></div><div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-gray-400">Applicant reason</p><p className="mt-2 text-xs leading-5 text-gray-600">{item.reason||"No reason supplied."}</p></div>{item.adminNote?<div className="text-[10px] text-gray-400">Review note: {item.adminNote}</div>:null}{item.status==="PENDING"?<div className="flex flex-wrap gap-2"><button type="button" disabled={busy===item.id} onClick={()=>void review(item.id,"APPROVED")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Approve & give blue tick</button><button type="button" disabled={busy===item.id} onClick={()=>void review(item.id,"REJECTED")} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 disabled:opacity-50">Reject</button></div>:null}</div></Card>):<Card><p className="py-6 text-center text-xs text-gray-400">No verification requests in this state.</p></Card>}</div>
  </div>;
}
function ModerationQueue({onMessage}:{onMessage:(value:string)=>void}) {
  const [reports,setReports]=useState<ReportRow[]>([]);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [status,setStatus]=useState<ReportRow["status"]>("PENDING");
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [nextBefore,setNextBefore]=useState<string | null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  const [currentAdminId,setCurrentAdminId]=useState<string|null>(null);

  async function load() {
    setLoading(true);
    try {
      const params=new URLSearchParams({status});
      if(query.trim()) params.set("q",query.trim());
      const response=await fetch("/api/admin/reports?"+params.toString(),{cache:"no-store"});
      const json=await response.json();
      if(!response.ok) throw new Error(json.error??"Could not load moderation queue.");
      setReports(json.reports??[]);setCounts(json.counts??{});setNextBefore(json.nextBefore??null);setCurrentAdminId(json.currentAdminId??null);
    } catch(e){onMessage(e instanceof Error?e.message:"Could not load moderation queue.");}
    finally{setLoading(false)}
  }

  useEffect(()=>{const timer=window.setTimeout(()=>void load(),250);return()=>window.clearTimeout(timer)},[status,query]);

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const params=new URLSearchParams({status,before:nextBefore});
      if(query.trim()) params.set("q",query.trim());
      const response=await fetch("/api/admin/reports?"+params.toString(),{cache:"no-store"});
      const json=await response.json();
      if(!response.ok) throw new Error(json.error??"Could not load more reports.");
      setReports(items=>[...items,...(json.reports??[])]);setCurrentAdminId(json.currentAdminId??currentAdminId);
      setNextBefore(json.nextBefore??null);
    } catch(e){onMessage(e instanceof Error?e.message:"Could not load more reports.");}
    finally{setLoadingMore(false)}
  }

  async function updateReport(id:string,next:ReportRow["status"]) {
    setBusy(id);
    try {
      const response=await fetch("/api/admin/reports",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:next})});
      const json=await response.json();if(!response.ok)throw new Error(json.error??"Could not update report.");
      setReports(items=>items.filter(item=>item.id!==id));
      setCounts(current=>({...current,[next.toLowerCase()]:Math.max(0,(current[next.toLowerCase()]??0)+1)}));
      onMessage("Report updated.");
    }catch(e){onMessage(e instanceof Error?e.message:"Could not update report.");}finally{setBusy("")}
  }

  async function updateMetadata(reportId:string, patch:Record<string,unknown>) {
    setBusy(reportId);
    try {
      const response=await fetch("/api/admin/reports",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:reportId,...patch})});
      const json=await response.json(); if(!response.ok) throw new Error(json.error??"Could not update report.");
      setReports(items=>items.map(item=>item.id===reportId?{...item,...json.report}:item));
      onMessage("Report workflow metadata updated.");
    } catch(e) { onMessage(e instanceof Error?e.message:"Could not update report."); }
    finally { setBusy(""); }
  }

  async function takeAction(report:ReportRow,action:"DELETE_POST"|"DELETE_COMMENT"|"DISABLE_USER") {
    const labels={DELETE_POST:"delete this post",DELETE_COMMENT:"delete this comment",DISABLE_USER:"disable this account"};
    if(!window.confirm("Are you sure you want to "+labels[action]+"? The action will be permanent/audited."))return;
    setBusy(report.id);
    try{
      const response=await fetch("/api/admin/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:report.id,action})});
      const json=await response.json();if(!response.ok)throw new Error(json.error??"Could not apply moderation action.");
      setReports(items=>items.filter(item=>item.id!==report.id));
      onMessage("Moderation action completed and audit record created.");
    }catch(e){onMessage(e instanceof Error?e.message:"Could not apply moderation action.");}finally{setBusy("")}
  }

  const count=(key:string)=>counts[key]??0;
  return <div className="space-y-5">
    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div><h2 className="text-sm font-black">Moderation queue</h2><p className="mt-1 text-xs text-gray-400">Review reports, take action, and keep every moderation decision auditable.</p></div>
        <div className="relative lg:ml-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search reason, user or content" className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#a79dff] lg:w-80"/></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{(["PENDING","REVIEWED","RESOLVED","DISMISSED"] as const).map(key=><button key={key} onClick={()=>setStatus(key)} className={"rounded-2xl px-4 py-2.5 text-xs font-black "+(status===key?"bg-[#eeebff] text-[#5a4be8]":"bg-gray-50 text-gray-500")}>{key[0]+key.slice(1).toLowerCase()} <span className="ml-1 text-[10px]">{count(key.toLowerCase())}</span></button>)}</div>
    </Card>
    <Card className="!p-0 overflow-hidden">
      {loading?<p className="p-8 text-center text-xs text-gray-400">Loading reports…</p>:reports.length===0?<div className="p-10 text-center"><ShieldCheck className="mx-auto text-emerald-500" size={24}/><p className="mt-3 text-sm font-black">No {status.toLowerCase()} reports</p><p className="mt-1 text-xs text-gray-400">{query?"No reports match your search.":"The queue is clear for this status."}</p></div>:
      <div className="divide-y divide-gray-100">{reports.map(report=><article key={report.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black">{report.reason}</p><p className="mt-1 text-[11px] text-gray-400">Reported by @{report.reporter.username??"member"} · {new Date(report.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">{report.status}</span></div>
        <div className="mt-3 rounded-2xl bg-gray-50 p-4 text-xs leading-5 text-gray-600">{report.reportedUser?<p>Profile: <strong>{report.reportedUser.name}</strong> @{report.reportedUser.username??"member"}</p>:null}{report.post?<p className="mt-1">Post: {report.post.content??"Media post"}</p>:null}{report.comment?<p className="mt-1">Comment: {report.comment.content}</p>:null}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-center">
          <select value={report.priority??"MEDIUM"} disabled={busy===report.id} onChange={(event)=>void updateMetadata(report.id,{priority:event.target.value})} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black"><option value="LOW">Low priority</option><option value="MEDIUM">Medium priority</option><option value="HIGH">High priority</option><option value="CRITICAL">Critical priority</option></select>
          <button type="button" disabled={busy===report.id} onClick={()=>void updateMetadata(report.id,{assignedToId:report.assignedTo?.id===currentAdminId?null:currentAdminId})} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black">{report.assignedTo?.id===currentAdminId?"Unassign me":report.assignedTo?"Assigned to "+(report.assignedTo.username?"@"+report.assignedTo.username:report.assignedTo.name):"Assign to me"}</button>
          <input defaultValue={report.moderatorNote??""} onBlur={(event)=>{if(event.target.value!==(report.moderatorNote??""))void updateMetadata(report.id,{note:event.target.value})}} maxLength={1000} placeholder="Moderator note…" className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold"/>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{report.status==="PENDING"?<button disabled={busy===report.id} onClick={()=>void updateReport(report.id,"REVIEWED")} className="rounded-xl bg-gray-950 px-3 py-2 text-[10px] font-black text-white">Mark reviewed</button>:null}
          {report.post?<button disabled={busy===report.id} onClick={()=>void takeAction(report,"DELETE_POST")} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700"><Trash2 size={13}/> Delete post</button>:null}
          {report.comment?<button disabled={busy===report.id} onClick={()=>void takeAction(report,"DELETE_COMMENT")} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700"><Trash2 size={13}/> Delete comment</button>:null}
          {report.reportedUser?<button disabled={busy===report.id} onClick={()=>void takeAction(report,"DISABLE_USER")} className="rounded-xl bg-orange-50 px-3 py-2 text-[10px] font-black text-orange-700">Disable account</button>:null}
          {report.status!=="RESOLVED"?<button disabled={busy===report.id} onClick={()=>void updateReport(report.id,"RESOLVED")} className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">Resolve</button>:null}
          {report.status!=="DISMISSED"?<button disabled={busy===report.id} onClick={()=>void updateReport(report.id,"DISMISSED")} className="rounded-xl bg-gray-100 px-3 py-2 text-[10px] font-black text-gray-600">Dismiss</button>:null}
        </div></article>)}</div>}{nextBefore?<div className="border-t border-gray-100 p-4 text-center"><button type="button" onClick={()=>void loadMore()} disabled={loadingMore} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-black text-gray-700 disabled:opacity-50">{loadingMore?"Loading…":"Load more reports"}</button></div>:null}
    </Card>
  </div>;
}

function ContentManager({onMessage}:{onMessage:(value:string)=>void}) {
  const [posts,setPosts]=useState<PostRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [nextBefore,setNextBefore]=useState<string|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);

  async function load(before?:string|null, append=false) {
    if (append) setLoadingMore(true); else setLoading(true);
    const params=new URLSearchParams({take:"50"});
    if(query.trim()) params.set("q",query.trim());
    if(before) params.set("before",before);
    try {
      const response=await fetch("/api/admin/posts?"+params.toString(),{cache:"no-store"});
      const json=await response.json();
      if(!response.ok) throw new Error(json.error??"Could not load content.");
      setPosts(current=>append?[...current,...(json.posts??[])]:json.posts??[]);
      setNextBefore(json.nextBefore??null);
    } catch(error) {
      onMessage(error instanceof Error?error.message:"Could not load content.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(()=>{const timer=window.setTimeout(()=>void load(),250);return()=>window.clearTimeout(timer)},[query]);

  async function updateVisibility(id:string,visibility:PostRow["visibility"]){
    const response=await fetch("/api/admin/posts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,visibility})});
    const json=await response.json();
    if(!response.ok){onMessage(json.error??"Could not update post.");return}
    setPosts(items=>items.map(item=>item.id===id?{...item,visibility}:item));
    onMessage("Post visibility updated.");
  }

  async function deletePost(id:string){
    if(!window.confirm("Delete this post and its related comments permanently?"))return;
    const response=await fetch("/api/admin/posts",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    const json=await response.json();
    if(!response.ok){onMessage(json.error??"Could not delete post.");return}
    setPosts(items=>items.filter(item=>item.id!==id));
    onMessage("Post deleted.");
  }

  return <Card className="!p-0 overflow-hidden">
    <div className="border-b border-gray-100 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-sm font-black">Content moderation</h2><p className="mt-1 text-xs text-gray-400">Search, review, change visibility, or remove posts. Every action is audited.</p></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search post or author" className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#a79dff] lg:w-80" aria-label="Search admin content"/></div>
      </div>
    </div>
    {loading?<p className="p-8 text-center text-xs text-gray-400">Loading posts…</p>:posts.length===0?<p className="p-8 text-center text-xs text-gray-400">No posts found.</p>:<div className="divide-y divide-gray-100">{posts.map(post=><article key={post.id} className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-600">{initials(post.author.name)}</span><div className="min-w-0 flex-1"><p className="text-xs font-black">{post.author.name} <span className="text-[10px] font-bold text-gray-400">@{post.author.username??"member"}</span></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{post.content??"Media post"}</p>{post.mediaUrl?<img src={post.mediaUrl} alt="" className="mt-3 max-h-72 w-full rounded-2xl object-cover"/>:null}<p className="mt-2 text-[10px] text-gray-400">{post._count.likes} likes · {post._count.comments} comments · {post._count.reports} reports · {new Date(post.createdAt).toLocaleString()}</p></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><select value={post.visibility} onChange={e=>void updateVisibility(post.id,e.target.value as PostRow["visibility"])} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black"><option value="PUBLIC">PUBLIC</option><option value="FRIENDS">FRIENDS</option><option value="PRIVATE">PRIVATE</option></select><button onClick={()=>void deletePost(post.id)} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700"><Trash2 size={13}/> Delete</button></div></article>)}</div>}
    {nextBefore ? <div className="border-t border-gray-100 p-4 text-center"><button type="button" onClick={()=>void load(nextBefore,true)} disabled={loadingMore} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[11px] font-black text-gray-700 disabled:opacity-40">{loadingMore?"Loading…":"Load more"}</button></div> : null}
  </Card>
}
function Audit(){
  const [logs,setLogs]=useState<any[]>([]);
  const [query,setQuery]=useState("");
  const [action,setAction]=useState("");
  const [targetType,setTargetType]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [nextBefore,setNextBefore]=useState<string|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>{void (async()=>{setLoading(true);setError("");try{
    const params=new URLSearchParams(); if(query.trim()) params.set("q",query.trim()); if(action) params.set("action",action); if(targetType) params.set("targetType",targetType);
    const response=await fetch("/api/admin/audit?"+params.toString(),{cache:"no-store"}); const json=await response.json(); if(!response.ok) throw new Error(json.error??"Could not load audit log."); setLogs(json.logs??[]); setNextBefore(json.nextBefore??null);
  }catch(e){setError(e instanceof Error?e.message:"Could not load audit log.");}finally{setLoading(false)}})()},200);return()=>window.clearTimeout(timer)},[query,action,targetType]);
  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const params=new URLSearchParams({before:nextBefore});
      if(query.trim()) params.set("q",query.trim()); if(action) params.set("action",action); if(targetType) params.set("targetType",targetType);
      const response=await fetch("/api/admin/audit?"+params.toString(),{cache:"no-store"});
      const json=await response.json(); if(!response.ok) throw new Error(json.error??"Could not load more audit entries.");
      setLogs((items)=>[...items,...(json.logs??[])]); setNextBefore(json.nextBefore??null);
    }catch(e){setError(e instanceof Error?e.message:"Could not load more audit entries.");}
    finally{setLoadingMore(false);}
  }
  function downloadCsv() {
    const params=new URLSearchParams({format:"csv"});
    if(query.trim()) params.set("q",query.trim()); if(action) params.set("action",action); if(targetType) params.set("targetType",targetType);
    window.location.href="/api/admin/audit?"+params.toString();
  }

  return <Card><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2"><History size={17}/><h2 className="text-sm font-black">Admin audit log</h2></div><p className="mt-1 text-xs text-gray-400">Searchable record of administrative and moderation actions.</p></div><div className="flex flex-col gap-2 sm:flex-row lg:ml-auto"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search action, target or details" className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#a79dff] sm:w-64"/><input value={action} onChange={e=>setAction(e.target.value)} placeholder="Action filter" className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#a79dff] sm:w-36"/><button type="button" onClick={downloadCsv} className="rounded-xl bg-gray-950 px-3 py-2 text-xs font-black text-white">Export CSV</button><select value={targetType} onChange={e=>setTargetType(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"><option value="">All targets</option><option value="USER">USER</option><option value="POST">POST</option><option value="COMMENT">COMMENT</option><option value="REPORT">REPORT</option><option value="CONVERSATION">CONVERSATION</option></select></div></div>
    {error?<p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>:null}
    <div className="mt-5 overflow-x-auto">{loading?<p className="py-8 text-center text-xs text-gray-400">Loading audit log…</p>:logs.length===0?<p className="py-8 text-center text-xs text-gray-400">No audit entries match these filters.</p>:<table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-gray-100 text-[10px] font-black uppercase tracking-[.12em] text-gray-400"><tr><th className="px-2 py-3">Time</th><th className="px-2 py-3">Action</th><th className="px-2 py-3">Target</th><th className="px-2 py-3">Details</th><th className="px-2 py-3">Admin</th></tr></thead><tbody>{logs.map((log:any)=><tr key={log.id} className="border-b border-gray-50"><td className="px-2 py-3 whitespace-nowrap text-gray-500">{new Date(log.createdAt).toLocaleString()}</td><td className="px-2 py-3 font-black">{log.action}</td><td className="px-2 py-3">{log.targetType}{log.targetId?" · "+log.targetId:""}</td><td className="max-w-[360px] truncate px-2 py-3 text-gray-500">{log.details||"—"}</td><td className="px-2 py-3 text-gray-500">{log.adminId}</td></tr>)}</tbody></table>}{nextBefore?<div className="mt-4 text-center"><button type="button" onClick={()=>void loadMore()} disabled={loadingMore} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[11px] font-black text-gray-700 disabled:opacity-40">{loadingMore?"Loading…":"Load more audit entries"}</button></div>:null}</div>
  </Card>;
}
