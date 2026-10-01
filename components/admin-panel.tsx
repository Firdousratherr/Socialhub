"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Check,
  Eye,
  FileText,
  Gauge,
  History,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AdminInspection } from "@/components/admin-inspection";

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
  createdAt: string;
  _count: { posts: number; followers: number; following: number };
};

type ReportRow = {
  id: string;
  reason: string;
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporter: { id: string; name: string; username: string | null; image: string | null };
  reportedUser: { id: string; name: string; username: string | null; image: string | null } | null;
  post: { id: string; content: string | null; mediaUrl: string | null } | null;
  comment: { id: string; content: string } | null;
};

type PostRow = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "PRIVATE";
  createdAt: string;
  author: { id: string; name: string; username: string | null; image: string | null };
  _count: { likes: number; comments: number; reports: number };
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={"rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(31,26,64,0.05)] " + className}>{children}</section>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-2xl bg-[#f1efff] text-[#5a4be8]"><Icon size={17}/></span>
        <span className="text-2xl font-black tracking-tight">{value}</span>
      </div>
      <p className="mt-4 text-xs font-bold text-gray-400">{label}</p>
    </Card>
  );
}

export function AdminPanel({ section = "overview" }: { section?: string }) {
  const normalize = (value: string) =>
    value === "engagement" ? "analytics" : value === "inspection" ? "user360" : value || "overview";

  const [active, setActive] = useState(normalize(section));
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setActive(normalize(section));
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        if (active === "overview" || active === "analytics" || active === "audit") {
          const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? "Could not load admin dashboard.");
          if (!cancelled) setDashboard(json);
        }

        if (active === "users") {
          const response = await fetch("/api/admin/users?take=100&q=" + encodeURIComponent(query), { cache: "no-store" });
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? "Could not load users.");
          if (!cancelled) setUsers(json.users ?? []);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load admin data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [active, query]);

  async function openUser(id: string) {
    setSelectedId(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users/" + id, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load user.");
      setSelected(json.user as UserRow);
    } catch (error) {
      setSelectedId("");
      setMessage(error instanceof Error ? error.message : "Could not load user.");
    }
  }

  async function saveUser(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setMessage("");
    const response = await fetch("/api/admin/users/" + selectedId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Could not update user.");
      return;
    }
    setSelected((current) => current ? { ...current, ...json.user } : current);
    setUsers((items) => items.map((item) => item.id === selectedId ? { ...item, ...json.user } : item));
    setMessage("User updated.");
  }

  const nav = [
    ["overview", "Dashboard", BarChart3],
    ["moderation", "Moderation", Shield],
    ["users", "Users", Users],
    ["user360", "User 360", UserRound],
    ["content", "Content", FileText],
    ["analytics", "Analytics", Activity],
    ["audit", "Audit logs", History],
  ] as const;

  const stats = dashboard?.stats ?? {};
  const selectedUser = selected;

  return (
    <main className="min-h-screen bg-[#f8f8fc] pb-10">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[30px] bg-gray-950 p-5 text-white shadow-[0_20px_60px_rgba(15,15,25,0.15)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-300">Socialhub Admin</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Control center</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">Operate the platform through real users, real reports, real content and auditable actions.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs font-bold">
              <span className="size-2 rounded-full bg-emerald-400"/> Protected admin controls
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-3xl border border-gray-100 bg-white p-2 shadow-[0_10px_35px_rgba(31,26,64,0.05)]">
            {nav.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => { setActive(key); setSelectedId(""); setSelected(null); setMessage(""); }}
                className={"flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-xs font-black transition " + (active === key ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500 hover:bg-gray-50")}
              >
                <Icon size={16}/>{label}
              </button>
            ))}
          </aside>

          <section className="min-w-0 space-y-5">
            {message ? <div role="status" className="rounded-2xl border border-[#ddd8ff] bg-[#f8f7ff] px-4 py-3 text-xs font-bold text-[#5a4be8]">{message}</div> : null}

            {active === "overview" ? <Dashboard dashboard={dashboard} loading={loading}/> : null}
            {active === "analytics" ? <Analytics dashboard={dashboard} loading={loading}/> : null}
            {active === "audit" ? <Audit logs={dashboard?.recentAudit ?? []} loading={loading}/> : null}
            {active === "moderation" ? <ModerationQueue onMessage={setMessage}/> : null}
            {active === "content" ? <ContentManager onMessage={setMessage}/> : null}
            {active === "user360" ? <AdminInspection/> : null}

            {active === "users" && !selectedId ? (
              <>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-sm font-black">User management</h2>
                      <p className="mt-1 text-xs text-gray-400">Search, inspect and manage real Socialhub accounts.</p>
                    </div>
                    <div className="relative sm:ml-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username or email" className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#a79dff] sm:w-80"/>
                    </div>
                  </div>
                </Card>
                <Card className="!p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[.12em] text-gray-400">
                        <tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Posts</th><th className="px-5 py-3">Followers</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
                      </thead>
                      <tbody>
                        {loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading users…</td></tr> :
                          users.map((user) => (
                            <tr key={user.id} className="border-t border-gray-100">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">{initials(user.name)}</span>
                                  <div><p className="font-black">{user.name}</p><p className="mt-0.5 text-[11px] text-gray-400">@{user.username ?? "member"} · {user.email}</p></div>
                                </div>
                              </td>
                              <td className="px-5 py-4"><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-600">{user.role}</span></td>
                              <td className="px-5 py-4 text-gray-500">{user._count.posts}</td>
                              <td className="px-5 py-4 text-gray-500">{user._count.followers}</td>
                              <td className="px-5 py-4">{user.isActive ? <span className="text-emerald-600">Active</span> : <span className="text-red-600">Disabled</span>}</td>
                              <td className="px-5 py-4"><button onClick={() => void openUser(user.id)} className="rounded-xl bg-gray-950 px-3 py-2 text-[10px] font-black text-white">Open</button></td>
                            </tr>
                          ))}
                        {!loading && users.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-xs text-gray-400">No users match this search.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : null}

            {active === "users" && selectedId && selectedUser ? <UserEditor user={selectedUser} onBack={() => { setSelectedId(""); setSelected(null); }} onSaveUser={saveUser}/> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function Dashboard({ dashboard, loading }: { dashboard: any; loading: boolean }) {
  if (loading && !dashboard) return <Card><p className="text-xs text-gray-400">Loading dashboard…</p></Card>;
  const s = dashboard?.stats ?? {};
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total members" value={s.users ?? 0} icon={Users}/>
        <Stat label="Active members" value={s.activeUsers ?? 0} icon={Activity}/>
        <Stat label="Total posts" value={s.posts ?? 0} icon={FileText}/>
        <Stat label="Total likes" value={s.likes ?? 0} icon={Gauge}/>
        <Stat label="Comments" value={s.comments ?? 0} icon={Eye}/>
        <Stat label="Followers" value={s.follows ?? 0} icon={Users}/>
        <Stat label="Messages" value={s.messages ?? 0} icon={Activity}/>
        <Stat label="Pending reports" value={s.pendingReports ?? 0} icon={Shield}/>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="text-sm font-black">Newest members</h2>
          <div className="mt-4 space-y-2">
            {(dashboard?.recentUsers ?? []).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                <span className="grid size-9 place-items-center rounded-full bg-violet-100 text-[10px] font-black text-violet-600">{initials(u.name)}</span>
                <div className="flex-1"><p className="text-xs font-black">{u.name}</p><p className="text-[11px] text-gray-400">@{u.username ?? "member"}</p></div>
                <span className="text-[10px] font-bold text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-black">Recent content</h2>
          <div className="mt-4 space-y-2">
            {(dashboard?.recentPosts ?? []).map((p: any) => (
              <div key={p.id} className="rounded-2xl bg-gray-50 p-3">
                <div className="flex justify-between gap-3"><p className="text-xs font-black">{p.author.name}</p><span className="text-[10px] text-gray-400">{p._count.likes} likes · {p._count.comments} comments</span></div>
                <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{p.content ?? "Media post"}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Analytics({ dashboard, loading }: { dashboard: any; loading: boolean }) {
  if (loading && !dashboard) return <Card><p className="text-xs text-gray-400">Loading analytics…</p></Card>;
  const s = dashboard?.stats ?? {};
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-sm font-black">Platform analytics</h2>
        <p className="mt-1 text-xs text-gray-400">These figures come from live database aggregates. They are not synthetic engagement values.</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Members" value={s.users ?? 0} icon={Users}/>
        <Stat label="Posts" value={s.posts ?? 0} icon={FileText}/>
        <Stat label="Comments" value={s.comments ?? 0} icon={Eye}/>
        <Stat label="Messages" value={s.messages ?? 0} icon={Activity}/>
      </div>
    </div>
  );
}

function UserEditor({ user, onBack, onSaveUser }: { user: UserRow; onBack: () => void; onSaveUser: (patch: Record<string, unknown>) => Promise<void> | void }) {
  const [saving, setSaving] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try { await onSaveUser(patch); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs font-black text-gray-500 hover:text-gray-950">← Back to users</button>
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-lg font-black text-white">{initials(user.name)}</span>
          <div className="flex-1"><h2 className="text-xl font-black">{user.name}</h2><p className="text-xs text-gray-400">@{user.username ?? "member"} · {user.email}</p></div>
          <span className={"rounded-full px-3 py-1.5 text-[10px] font-black " + (user.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>{user.isActive ? "ACTIVE" : "DISABLED"}</span>
        </div>
      </Card>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" value={user.name} onSave={(value) => void save({ name: value })} />
          <Field label="Username" value={user.username ?? ""} onSave={(value) => void save({ username: value || null })} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button disabled={saving} onClick={() => void save({ isActive: !user.isActive })} className={"rounded-2xl px-4 py-3 text-xs font-black " + (user.isActive ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>{user.isActive ? "Disable account" : "Activate account"}</button>
          <select value={user.role} disabled={saving} onChange={(e) => void save({ role: e.target.value })} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-black">
            <option value="USER">USER</option><option value="MODERATOR">MODERATOR</option><option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-gray-400">Account signals</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <span className="text-xs font-bold text-gray-600">{user._count.posts} posts</span>
            <span className="text-xs font-bold text-gray-600">{user._count.followers} followers</span>
            <span className="text-xs font-bold text-gray-600">{user._count.following} following</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, onSave }: { label: string; value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <label className="text-[11px] font-black text-gray-500">{label}</label>
      {editing ? (
        <div className="mt-2 flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"/>
          <button onClick={() => { onSave(draft); setEditing(false); }} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white"><Check size={14}/></button>
          <button onClick={() => setEditing(false)} className="grid size-9 place-items-center rounded-xl bg-white text-gray-500"><X size={14}/></button>
        </div>
      ) : (
        <button onClick={() => { setDraft(value); setEditing(true); }} className="mt-2 flex w-full items-center justify-between text-left text-sm font-black">
          {value || "Not set"}<span className="text-[10px] text-gray-400">Edit</span>
        </button>
      )}
    </div>
  );
}

function ModerationQueue({ onMessage }: { onMessage: (value: string) => void }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/reports", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) {
      onMessage(json.error ?? "Could not load moderation queue.");
      setLoading(false);
      return;
    }
    setReports(json.reports ?? []);
    setCounts(json.counts ?? {});
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const visible = reports.filter((report) => report.status === status);

  async function updateReport(id: string, next: string) {
    const response = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    const json = await response.json();
    if (!response.ok) {
      onMessage(json.error ?? "Could not update report.");
      return;
    }
    setReports((items) => items.map((item) => item.id === id ? { ...item, status: next as ReportRow["status"] } : item));
    onMessage("Report updated.");
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["PENDING", "Pending"],
            ["REVIEWED", "Reviewed"],
            ["RESOLVED", "Resolved"],
            ["DISMISSED", "Dismissed"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setStatus(key)} className={"rounded-2xl px-4 py-2.5 text-xs font-black " + (status === key ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-50 text-gray-500")}>
              {label} <span className="ml-1 text-[10px]">{counts[key.toLowerCase()] ?? 0}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="!p-0 overflow-hidden">
        {loading ? <p className="p-8 text-center text-xs text-gray-400">Loading reports…</p> :
          visible.length === 0 ? <div className="p-10 text-center"><ShieldCheck className="mx-auto text-emerald-500" size={24}/><p className="mt-3 text-sm font-black">No {status.toLowerCase()} reports</p><p className="mt-1 text-xs text-gray-400">The queue is clear for this status.</p></div> :
          <div className="divide-y divide-gray-100">{visible.map((report) => (
            <article key={report.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-black">{report.reason}</p><p className="mt-1 text-[11px] text-gray-400">Reported by @{report.reporter.username ?? "member"} · {new Date(report.createdAt).toLocaleString()}</p></div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">{report.status}</span>
              </div>
              <div className="mt-3 rounded-2xl bg-gray-50 p-4 text-xs leading-5 text-gray-600">
                {report.reportedUser ? <p>Profile: <strong>{report.reportedUser.name}</strong> @{report.reportedUser.username ?? "member"}</p> : null}
                {report.post ? <p className="mt-1">Post: {report.post.content ?? "Media post"}</p> : null}
                {report.comment ? <p className="mt-1">Comment: {report.comment.content}</p> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {report.status === "PENDING" ? <button onClick={() => void updateReport(report.id, "REVIEWED")} className="rounded-xl bg-gray-950 px-3 py-2 text-[10px] font-black text-white">Mark reviewed</button> : null}
                {report.status !== "RESOLVED" ? <button onClick={() => void updateReport(report.id, "RESOLVED")} className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">Resolve</button> : null}
                {report.status !== "DISMISSED" ? <button onClick={() => void updateReport(report.id, "DISMISSED")} className="rounded-xl bg-gray-100 px-3 py-2 text-[10px] font-black text-gray-600">Dismiss</button> : null}
              </div>
            </article>
          ))}</div>
        }
      </Card>
    </div>
  );
}

function ContentManager({ onMessage }: { onMessage: (value: string) => void }) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/posts", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) {
      onMessage(json.error ?? "Could not load content.");
      setLoading(false);
      return;
    }
    setPosts(json.posts ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateVisibility(id: string, visibility: PostRow["visibility"]) {
    const response = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visibility }),
    });
    const json = await response.json();
    if (!response.ok) {
      onMessage(json.error ?? "Could not update post.");
      return;
    }
    setPosts((items) => items.map((item) => item.id === id ? { ...item, visibility } : item));
    onMessage("Post visibility updated.");
  }

  async function deletePost(id: string) {
    if (!window.confirm("Delete this post and its related comments permanently?")) return;
    const response = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await response.json();
    if (!response.ok) {
      onMessage(json.error ?? "Could not delete post.");
      return;
    }
    setPosts((items) => items.filter((item) => item.id !== id));
    onMessage("Post deleted.");
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <div><h2 className="text-sm font-black">Content moderation</h2><p className="mt-1 text-xs text-gray-400">Hide content by changing visibility or permanently remove a post. Every action is audited.</p></div>
        <FileText className="text-gray-300" size={20}/>
      </div>
      {loading ? <p className="p-8 text-center text-xs text-gray-400">Loading posts…</p> :
        posts.length === 0 ? <p className="p-8 text-center text-xs text-gray-400">No posts found.</p> :
        <div className="divide-y divide-gray-100">{posts.map((post) => (
          <article key={post.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-600">{initials(post.author.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black">{post.author.name} <span className="text-[10px] font-bold text-gray-400">@{post.author.username ?? "member"}</span></p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{post.content ?? "Media post"}</p>
                {post.mediaUrl ? <img src={post.mediaUrl} alt="" className="mt-3 max-h-72 w-full rounded-2xl object-cover"/> : null}
                <p className="mt-2 text-[10px] text-gray-400">{post._count.likes} likes · {post._count.comments} comments · {post._count.reports} reports · {new Date(post.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 pl-13">
              <select value={post.visibility} onChange={(e) => void updateVisibility(post.id, e.target.value as PostRow["visibility"])} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black">
                <option value="PUBLIC">PUBLIC</option><option value="FRIENDS">FRIENDS</option><option value="PRIVATE">PRIVATE</option>
              </select>
              <button onClick={() => void deletePost(post.id)} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700"><Trash2 size={13}/> Delete</button>
            </div>
          </article>
        ))}</div>
      }
    </Card>
  );
}

function Audit({ logs, loading }: { logs: any[]; loading: boolean }) {
  return (
    <Card>
      <div className="flex items-center gap-2"><History size={17}/><h2 className="text-sm font-black">Recent admin actions</h2></div>
      {loading ? <p className="mt-5 text-xs text-gray-400">Loading audit log…</p> :
        <div className="mt-4 divide-y divide-gray-100">
          {logs.length ? logs.map((log: any) => (
            <div key={log.id} className="py-3">
              <p className="text-xs font-black">{log.action}</p>
              <p className="mt-1 text-[11px] text-gray-400">{log.targetType}{log.targetId ? " · " + log.targetId : ""} · {new Date(log.createdAt).toLocaleString()}</p>
            </div>
          )) : <p className="py-6 text-xs text-gray-400">No admin actions recorded yet.</p>}
        </div>
      }
    </Card>
  );
}
