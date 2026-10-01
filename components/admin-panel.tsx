"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Check, Edit3, Eye, FileText, Gauge, History, Search, Shield, UserCog, Users, X } from "lucide-react";

type UserRow = {
  id: string; name: string; username: string | null; email: string; image: string | null;
  role: "USER" | "MODERATOR" | "ADMIN"; isActive: boolean; isPrivate: boolean;
  emailVerified: boolean; createdAt: string;
  _count: { posts: number; followers: number; following: number };
};

type Metrics = {
  followers: number; following: number; posts: number; likesReceived: number;
  commentsReceived: number; shares: number; profileViews: number;
};

const metricLabels: Array<[keyof Metrics, string]> = [
  ["followers","Followers"],["following","Following"],["posts","Posts"],
  ["likesReceived","Likes received"],["commentsReceived","Comments received"],
  ["shares","Shares"],["profileViews","Profile views"],
];

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase();
}

function Card({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <section className={"rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(31,26,64,0.05)] " + className}>{children}</section>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return <Card><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-2xl bg-[#f1efff] text-[#5a4be8]"><Icon size={17}/></span><span className="text-2xl font-black tracking-tight">{value}</span></div><p className="mt-4 text-xs font-bold text-gray-400">{label}</p></Card>;
}

export function AdminPanel({ section="overview" }: { section?: string }) {
  const [active, setActive] = useState(section);
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [metrics, setMetrics] = useState<{actual: Metrics; visible: Metrics; override: Partial<Metrics> | null} | null>(null);
  const [draftMetrics, setDraftMetrics] = useState<Partial<Record<keyof Metrics,string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { setActive(section || "overview"); }, [section]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setMessage("");
      try {
        if (active === "overview") {
          const response = await fetch("/api/admin/dashboard",{cache:"no-store"});
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? "Could not load dashboard.");
          if (!cancelled) setDashboard(json);
        } else if (active === "users" || active === "engagement") {
          const response = await fetch("/api/admin/users?take=100&q="+encodeURIComponent(query),{cache:"no-store"});
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? "Could not load users.");
          if (!cancelled) setUsers(json.users ?? []);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load admin data.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [active, query]);

  async function openUser(id: string) {
    setSelectedId(id); setMessage("");
    try {
      const [userResponse, metricResponse] = await Promise.all([
        fetch("/api/admin/users/"+id,{cache:"no-store"}),
        fetch("/api/admin/users/"+id+"/engagement",{cache:"no-store"}),
      ]);
      const userJson = await userResponse.json(); const metricJson = await metricResponse.json();
      if (!userResponse.ok) throw new Error(userJson.error ?? "Could not load user.");
      if (!metricResponse.ok) throw new Error(metricJson.error ?? "Could not load engagement.");
      setSelected(userJson); setMetrics(metricJson);
      setDraftMetrics(Object.fromEntries(metricLabels.map(([key]) => [key, metricJson.visible[key] === null || metricJson.visible[key] === undefined ? "" : String(metricJson.visible[key])])) as any);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load user."); }
  }

  async function saveUser(patch: Record<string, unknown>) {
    if (!selectedId || saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/users/"+selectedId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)});
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update user.");
      setSelected((current:any) => current ? {...current,user:{...current.user,...json.user}} : current);
      setUsers((items)=>items.map((item)=>item.id===selectedId ? {...item,...json.user} : item));
      setMessage("User updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update user."); }
    finally { setSaving(false); }
  }

  async function saveMetrics() {
    if (!selectedId || saving) return;
    setSaving(true); setMessage("");
    const body: Record<string, number | null> = {};
    for (const [key] of metricLabels) {
      const value = draftMetrics[key];
      body[key] = value === "" || value === undefined ? null : Math.max(0, Math.floor(Number(value)));
    }
    try {
      const response = await fetch("/api/admin/users/"+selectedId+"/engagement",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save metrics.");
      setMessage("Engagement controls saved.");
      await openUser(selectedId);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save metrics."); }
    finally { setSaving(false); }
  }

  const filteredUsers = useMemo(() => users, [users]);

  const nav = [
    ["overview","Dashboard",BarChart3],["users","Users",Users],["engagement","Engagement",Activity],
    ["posts","Content",FileText],["reports","Moderation",Shield],["audit","Audit logs",History],
  ] as const;

  const stats = dashboard?.stats;
  const selectedUser = selected?.user;

  return <main className="min-h-screen bg-[#f8f8fc] pb-10">
    <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-[30px] bg-gray-950 p-5 text-white shadow-[0_20px_60px_rgba(15,15,25,0.15)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-300">Socialhub Admin</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Control center</h1><p className="mt-2 max-w-2xl text-sm text-white/55">Manage users, engagement, content and moderation from one protected workspace.</p></div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs font-bold"><span className="size-2 rounded-full bg-emerald-400"/> Protected admin controls</div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-3xl border border-gray-100 bg-white p-2 shadow-[0_10px_35px_rgba(31,26,64,0.05)]">
          {nav.map(([key,label,Icon]) => <button key={key} onClick={()=>{setActive(key);setSelectedId("");setSelected(null)}} className={"flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-xs font-black transition " + (active===key ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500 hover:bg-gray-50")}><Icon size={16}/>{label}</button>)}
        </aside>

        <section className="min-w-0 space-y-5">
          {message ? <div role="status" className="rounded-2xl border border-[#ddd8ff] bg-[#f8f7ff] px-4 py-3 text-xs font-bold text-[#5a4be8]">{message}</div> : null}

          {active==="overview" ? <Dashboard dashboard={dashboard} loading={loading}/> : null}

          {(active==="users" || active==="engagement") && !selectedId ? <>
            <Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black">{active==="users" ? "User management" : "Engagement manager"}</h2><p className="mt-1 text-xs text-gray-400">{active==="users" ? "Search and manage every Socialhub account." : "Select a user to control visible engagement metrics."}</p></div><div className="relative sm:ml-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name, username or email" className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#a79dff] sm:w-80"/></div></div></Card>
            <Card className="!p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[.12em] text-gray-400"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Posts</th><th className="px-5 py-3">Followers</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading users…</td></tr> : filteredUsers.map((user)=><tr key={user.id} className="border-t border-gray-100"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">{initials(user.name)}</span><div><p className="font-black">{user.name}</p><p className="mt-0.5 text-[11px] text-gray-400">@{user.username ?? "member"} · {user.email}</p></div></div></td><td className="px-5 py-4"><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-600">{user.role}</span></td><td className="px-5 py-4 text-gray-500">{user._count.posts}</td><td className="px-5 py-4 text-gray-500">{user._count.followers}</td><td className="px-5 py-4">{user.isActive ? <span className="text-emerald-600">Active</span> : <span className="text-red-600">Disabled</span>}</td><td className="px-5 py-4"><button onClick={()=>void openUser(user.id)} className="rounded-xl bg-gray-950 px-3 py-2 text-[10px] font-black text-white">{active==="engagement" ? "Manage" : "Open"}</button></td></tr>)}</tbody></table></div></Card>
          </> : null}

          {(active==="users" || active==="engagement") && selectedId && selectedUser ? <UserEditor user={selectedUser} metrics={metrics} draftMetrics={draftMetrics} setDraftMetrics={setDraftMetrics} onBack={()=>setSelectedId("")} onSaveUser={saveUser} onSaveMetrics={saveMetrics} saving={saving} engagement={active==="engagement"}/> : null}

          {active==="posts" ? <Placeholder title="Content manager" text="The next admin phase will add edit, hide, delete, pin, and engagement controls for posts and comments." icon={FileText}/> : null}
          {active==="reports" ? <Placeholder title="Moderation workspace" text="The existing protected reports system remains available here. We will expand it with richer actions in the next phase." icon={Shield}/> : null}
          {active==="audit" ? <Audit logs={dashboard?.recentAudit ?? []}/> : null}
        </section>
      </div>
    </div>
  </main>;
}

function Dashboard({dashboard,loading}:{dashboard:any;loading:boolean}) {
  if (loading && !dashboard) return <Card><p className="text-xs text-gray-400">Loading dashboard…</p></Card>;
  const s=dashboard?.stats ?? {};
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Total members" value={s.users ?? 0} icon={Users}/><Stat label="Active members" value={s.activeUsers ?? 0} icon={Activity}/>
      <Stat label="Total posts" value={s.posts ?? 0} icon={FileText}/><Stat label="Total likes" value={s.likes ?? 0} icon={Gauge}/>
      <Stat label="Comments" value={s.comments ?? 0} icon={Eye}/><Stat label="Followers" value={s.follows ?? 0} icon={Users}/>
      <Stat label="Messages" value={s.messages ?? 0} icon={Activity}/><Stat label="Pending reports" value={s.pendingReports ?? 0} icon={Shield}/>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><h2 className="text-sm font-black">Newest members</h2><div className="mt-4 space-y-2">{(dashboard?.recentUsers??[]).map((u:any)=><div key={u.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"><span className="grid size-9 place-items-center rounded-full bg-violet-100 text-[10px] font-black text-violet-600">{initials(u.name)}</span><div className="flex-1"><p className="text-xs font-black">{u.name}</p><p className="text-[11px] text-gray-400">@{u.username??"member"}</p></div><span className="text-[10px] font-bold text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</span></div>)}</div></Card>
      <Card><h2 className="text-sm font-black">Recent content</h2><div className="mt-4 space-y-2">{(dashboard?.recentPosts??[]).map((p:any)=><div key={p.id} className="rounded-2xl bg-gray-50 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-black">{p.author.name}</p><span className="text-[10px] text-gray-400">{p._count.likes} likes · {p._count.comments} comments</span></div><p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{p.content??"Media post"}</p></div>)}</div></Card>
    </div>
  </>;
}

function UserEditor({user,metrics,draftMetrics,setDraftMetrics,onBack,onSaveUser,onSaveMetrics,saving,engagement}:{user:UserRow;metrics:any;draftMetrics:any;setDraftMetrics:any;onBack:()=>void;onSaveUser:(patch:Record<string,unknown>)=>void;onSaveMetrics:()=>void;saving:boolean;engagement:boolean}) {
  const [tab,setTab]=useState(engagement?"engagement":"account");
  return <div className="space-y-5">
    <button onClick={onBack} className="text-xs font-black text-gray-500 hover:text-gray-950">← Back to users</button>
    <Card><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-lg font-black text-white">{initials(user.name)}</span><div className="flex-1"><h2 className="text-xl font-black">{user.name}</h2><p className="text-xs text-gray-400">@{user.username??"member"} · {user.email}</p></div><span className={"rounded-full px-3 py-1.5 text-[10px] font-black "+(user.isActive?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-600")}>{user.isActive?"ACTIVE":"DISABLED"}</span></div></Card>
    <div className="flex gap-2 rounded-2xl border border-gray-100 bg-white p-1.5"><button onClick={()=>setTab("account")} className={"flex-1 rounded-xl px-3 py-2.5 text-xs font-black "+(tab==="account"?"bg-[#eeebff] text-[#5a4be8]":"text-gray-500")}>Account controls</button><button onClick={()=>setTab("engagement")} className={"flex-1 rounded-xl px-3 py-2.5 text-xs font-black "+(tab==="engagement"?"bg-[#eeebff] text-[#5a4be8]":"text-gray-500")}>Engagement controls</button></div>
    {tab==="account" ? <Card><div className="grid gap-4 sm:grid-cols-2"><Field label="Display name" value={user.name} onSave={(v)=>onSaveUser({name:v})}/><Field label="Username" value={user.username??""} onSave={(v)=>onSaveUser({username:v||null})}/></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button disabled={saving} onClick={()=>onSaveUser({isActive:!user.isActive})} className={"rounded-2xl px-4 py-3 text-xs font-black "+(user.isActive?"bg-red-50 text-red-600":"bg-emerald-50 text-emerald-600")}>{user.isActive?"Disable account":"Activate account"}</button><select value={user.role} disabled={saving} onChange={(e)=>onSaveUser({role:e.target.value})} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-black"><option value="USER">USER</option><option value="MODERATOR">MODERATOR</option><option value="ADMIN">ADMIN</option></select></div></Card> :
    <Card><div className="flex items-center justify-between"><div><h2 className="text-sm font-black">Visible engagement</h2><p className="mt-1 text-xs text-gray-400">Blank values revert to live database counts. Overrides are audited.</p></div><Edit3 size={17} className="text-gray-400"/></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{metricLabels.map(([key,label])=><div key={key} className="rounded-2xl bg-gray-50 p-4"><label className="text-[11px] font-black text-gray-500">{label}</label><div className="mt-2 flex items-center gap-2"><input inputMode="numeric" value={draftMetrics[key]??""} onChange={(e)=>setDraftMetrics((d:any)=>({...d,[key]:e.target.value.replace(/[^0-9]/g,"")}))} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#a79dff]"/><span className="whitespace-nowrap text-[10px] font-bold text-gray-400">live {metrics?.actual?.[key]??0}</span></div></div>)}</div><button disabled={saving} onClick={()=>void onSaveMetrics()} className="mt-5 flex items-center gap-2 rounded-2xl bg-gray-950 px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Check size={15}/>{saving?"Saving…":"Save engagement controls"}</button></Card>}
  </div>;
}

function Field({label,value,onSave}:{label:string;value:string;onSave:(value:string)=>void}) {
  const [draft,setDraft]=useState(value); const [editing,setEditing]=useState(false);
  return <div className="rounded-2xl bg-gray-50 p-4"><label className="text-[11px] font-black text-gray-500">{label}</label>{editing?<div className="mt-2 flex gap-2"><input value={draft} onChange={(e)=>setDraft(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"/><button onClick={()=>{onSave(draft);setEditing(false)}} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white"><Check size={14}/></button><button onClick={()=>setEditing(false)} className="grid size-9 place-items-center rounded-xl bg-white text-gray-500"><X size={14}/></button></div>:<button onClick={()=>setEditing(true)} className="mt-2 flex w-full items-center justify-between text-left text-sm font-black">{value||"Not set"}<Edit3 size={14} className="text-gray-400"/></button>}</div>;
}

function Audit({logs}:{logs:any[]}) {
  return <Card><div className="flex items-center gap-2"><History size={17}/><h2 className="text-sm font-black">Recent admin actions</h2></div><div className="mt-4 divide-y divide-gray-100">{logs.length?logs.map((log:any)=><div key={log.id} className="py-3"><p className="text-xs font-black">{log.action}</p><p className="mt-1 text-[11px] text-gray-400">{log.targetType}{log.targetId?" · "+log.targetId:""} · {new Date(log.createdAt).toLocaleString()}</p></div>):<p className="py-6 text-xs text-gray-400">No admin actions recorded yet.</p>}</div></Card>;
}

function Placeholder({title,text,icon:Icon}:{title:string;text:string;icon:React.ElementType}) {
  return <Card><span className="grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Icon size={20}/></span><h2 className="mt-4 text-lg font-black">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">{text}</p></Card>;
}
