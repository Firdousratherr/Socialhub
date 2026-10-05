"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  GitBranch,
  History,
  LockKeyhole,
  RotateCcw,
  Search,
  Shield,
  UserRound,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

type Tab = "command" | "cases" | "enforcement" | "risk" | "graph" | "integrity" | "limits" | "appeals" | "approvals";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={"rounded-[26px] border border-gray-100 bg-white p-4 shadow-[0_14px_50px_rgba(31,26,64,0.06)] " + className}>{children}</section>;
}
function Btn({ children, onClick, danger = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={"rounded-xl px-3 py-2 text-[10px] font-black transition disabled:opacity-40 " + (danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-gray-950 text-white hover:bg-gray-800")}>{children}</button>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-[#a79dff] " + (props.className ?? "")} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={"h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-black outline-none focus:border-[#a79dff] " + (props.className ?? "")} />;
}
function fmt(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function AdminIntelligencePanel() {
  const [tab, setTab] = useState<Tab>("command");
  const [notice, setNotice] = useState("");
  const nav: Array<[Tab, string]> = [
    ["command", "Command"], ["cases", "Cases"], ["enforcement", "Enforcement"], ["risk", "Risk"],
    ["graph", "Social graph"], ["integrity", "Integrity"], ["limits", "Rate limits"], ["appeals", "Appeals"], ["approvals", "Approvals"],
  ];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Gauge size={18} /></span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#6d5dfc]">Admin 4.0</p>
              <h2 className="text-lg font-black tracking-tight">Intelligence & control</h2>
              <p className="text-[11px] text-gray-400">Investigate, enforce, recover and audit without leaving the admin workspace.</p>
            </div>
          </div>
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">{nav.map(([id, label]) => <button key={id} type="button" onClick={() => { setTab(id); setNotice(""); }} className={"shrink-0 rounded-xl px-3 py-2 text-[9px] font-black " + (tab === id ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-50 text-gray-500 hover:bg-gray-100")}>{label}</button>)}</div>
        </div>
      </Card>
      {notice ? <div role="status" className="flex items-start gap-2 rounded-2xl border border-[#ddd8ff] bg-[#f8f7ff] px-4 py-3 text-xs font-bold text-[#5a4be8]"><span className="min-w-0 flex-1">{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><XCircle size={14} /></button></div> : null}
      {tab === "command" ? <Command onNotice={setNotice} /> : null}
      {tab === "cases" ? <Cases onNotice={setNotice} /> : null}
      {tab === "enforcement" ? <Enforcement onNotice={setNotice} /> : null}
      {tab === "risk" ? <Risk onNotice={setNotice} /> : null}
      {tab === "graph" ? <SocialGraph onNotice={setNotice} /> : null}
      {tab === "integrity" ? <Integrity onNotice={setNotice} /> : null}
      {tab === "limits" ? <Limits onNotice={setNotice} /> : null}
      {tab === "appeals" ? <Appeals onNotice={setNotice} /> : null}
      {tab === "approvals" ? <Approvals onNotice={setNotice} /> : null}
    </div>
  );
}

function Command({ onNotice }: { onNotice: (s: string) => void }) {
  const [data, setData] = useState<any>(null);
  async function load() {
    try {
      const r = await fetch("/api/admin/command-center", { cache: "no-store" }); const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not load command center.");
      setData(j);
    } catch (e) { onNotice(e instanceof Error ? e.message : "Could not load command center."); }
  }
  useEffect(() => { void load(); }, []);
  const cards = [
    ["Users today", data?.today?.users ?? 0], ["Posts today", data?.today?.posts ?? 0],
    ["Comments today", data?.today?.comments ?? 0], ["Messages today", data?.today?.messages ?? 0],
    ["Pending reports", data?.live?.pendingReports ?? 0], ["Critical reports", data?.live?.criticalReports ?? 0],
    ["Open cases", data?.live?.openCases ?? 0], ["Pending appeals", data?.live?.pendingAppeals ?? 0],
    ["Active restrictions", data?.live?.activeRestrictions ?? 0], ["Failed admin logins", data?.security?.failedAdminLogins ?? 0],
  ];
  return <div className="space-y-4">
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">{cards.map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-gray-400">{label}</p><p className="mt-2 text-2xl font-black">{String(value)}</p></Card>)}</div>
    <Card><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Recent privileged events</h3><p className="mt-1 text-[10px] text-gray-400">The newest high-signal admin operations.</p></div><Btn onClick={() => void load()}>Refresh</Btn></div><div className="mt-4 space-y-2">{(data?.recentEvents ?? []).map((event: any) => <div key={event.id} className="flex items-start gap-3 rounded-2xl bg-gray-50 p-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white"><History size={14} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-black">{event.action} <span className="font-bold text-gray-400">· {event.resource}</span></p><p className="mt-1 text-[10px] text-gray-400">{event.resourceId ?? "system"} · {fmt(event.createdAt)}</p></div><span className={"rounded-full px-2 py-1 text-[8px] font-black " + (event.riskLevel === "CRITICAL" ? "bg-red-50 text-red-600" : event.riskLevel === "HIGH" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500")}>{event.riskLevel}</span></div>)}{!data?.recentEvents?.length ? <p className="text-xs text-gray-400">No privileged events recorded yet.</p> : null}</div></Card>
  </div>;
}

function Cases({ onNotice }: { onNotice: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]); const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [priority, setPriority] = useState(""); const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", category: "OTHER", priority: "MEDIUM", subjectUserId: "", reason: "" });
  async function load() {
    try { const url = "/api/admin/cases?take=100" + (q ? "&q=" + encodeURIComponent(q) : "") + (status ? "&status=" + status : "") + (priority ? "&priority=" + priority : ""); const r=await fetch(url,{cache:"no-store"}); const j=await r.json(); if(!r.ok) throw new Error(j.error??"Could not load cases."); setItems(j.cases??[]); } catch(e){onNotice(e instanceof Error?e.message:"Could not load cases.");}
  }
  useEffect(()=>{void load();},[q,status,priority]);
  async function create() {
    const r=await fetch("/api/admin/cases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,subjectUserId:form.subjectUserId||null})}); const j=await r.json(); if(!r.ok){onNotice(j.error??"Could not create case.");return;} onNotice("Case created and audited."); setForm({title:"",category:"OTHER",priority:"MEDIUM",subjectUserId:"",reason:""});setShowCreate(false);void load();
  }
  async function update(id:string,patch:Record<string,unknown>){const r=await fetch("/api/admin/cases",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...patch})});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not update case.");return;}onNotice("Case updated and audited.");void load();}
  return <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]"><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search case ID, title or reason"/><Select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option>OPEN</option><option>IN_REVIEW</option><option>RESOLVED</option><option>DISMISSED</option></Select><Select value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></Select><Btn onClick={()=>setShowCreate(v=>!v)}>{showCreate?"Close":"New case"}</Btn></div>
    {showCreate?<Card><div className="grid gap-2 md:grid-cols-2"><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Case title"/><Input value={form.subjectUserId} onChange={e=>setForm({...form,subjectUserId:e.target.value})} placeholder="Subject user ID (optional)"/><Select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>OTHER</option><option>SPAM</option><option>HARASSMENT</option><option>SAFETY</option><option>ACCOUNT</option><option>MESSAGING</option><option>SECURITY</option></Select><Select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></Select><textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Reason / investigation context" className="min-h-24 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs outline-none md:col-span-2"/><div className="md:col-span-2"><Btn onClick={()=>void create()} disabled={!form.title.trim()||!form.reason.trim()}>Create case</Btn></div></div></Card>:null}
    <Card><div className="space-y-2">{items.map(item=><div key={item.id} className="rounded-2xl border border-gray-100 p-3 sm:p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-[8px] font-black">{item.category}</span><span className={"rounded-full px-2 py-1 text-[8px] font-black " + (item.priority==="CRITICAL"?"bg-red-50 text-red-600":item.priority==="HIGH"?"bg-amber-50 text-amber-700":"bg-gray-100 text-gray-500")}>{item.priority}</span><span className="rounded-full bg-[#eeebff] px-2 py-1 text-[8px] font-black text-[#5a4be8]">{item.status}</span></div><p className="mt-2 text-xs font-black">{item.title}</p><p className="mt-1 text-[10px] text-gray-500">{item.reason}</p><p className="mt-2 text-[9px] text-gray-400">Case {item.id} · {fmt(item.createdAt)} {item.subjectUser ? "· " + item.subjectUser.name : ""}</p></div><div className="flex flex-wrap gap-2"><Select value={item.status} onChange={e=>void update(item.id,{status:e.target.value})} className="w-36"/><Btn onClick={()=>void update(item.id,{status:"IN_REVIEW"})}>Review</Btn><Btn onClick={()=>void update(item.id,{status:"RESOLVED",resolution:"Resolved by administrator."})}>Resolve</Btn><Btn danger onClick={()=>void update(item.id,{status:"DISMISSED",resolution:"Dismissed by administrator."})}>Dismiss</Btn></div></div></div>)}{!items.length?<p className="p-8 text-center text-xs text-gray-400">No cases match these filters.</p>:null}</div></Card>
  </div>;
}

function Enforcement({ onNotice }: { onNotice: (s: string) => void }) {
  const [userId,setUserId]=useState(""); const [action,setAction]=useState("WARN"); const [reason,setReason]=useState(""); const [duration,setDuration]=useState("60"); const [history,setHistory]=useState<any[]>([]); const [saving,setSaving]=useState(false);
  async function load(){if(!userId.trim())return;const r=await fetch("/api/admin/enforcement?userId="+encodeURIComponent(userId.trim()),{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not load enforcement history.");return;}setHistory(j.actions??[]);}
  async function apply(){setSaving(true);try{const r=await fetch("/api/admin/enforcement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId.trim(),action,reason:reason.trim(),durationMinutes:duration===""?null:Number(duration)})});const j=await r.json();if(!r.ok){onNotice(j.error??"Enforcement failed.");return;}onNotice("Enforcement action applied and audited.");setReason("");await load();}finally{setSaving(false);}}
  return <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]"><Card><h3 className="text-sm font-black">Apply enforcement</h3><p className="mt-1 text-[10px] text-gray-400">Every action creates an enforcement record and rich audit event.</p><div className="mt-4 space-y-2"><Input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="Target user ID"/><Select value={action} onChange={e=>setAction(e.target.value)}><option>WARN</option><option>RESTRICT_POSTING</option><option>RESTRICT_COMMENTING</option><option>RESTRICT_MESSAGING</option><option>RESTRICT_SOCIAL</option><option>SUSPEND</option><option>DISABLE</option><option>RESTORE</option><option>FORCE_PASSWORD_RESET</option><option>REVOKE_SESSIONS</option><option>VERIFY</option><option>UNVERIFY</option></Select><div className="grid grid-cols-[1fr_auto] gap-2"><Input inputMode="numeric" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Minutes"/><span className="grid h-10 place-items-center rounded-xl bg-gray-50 px-3 text-[9px] font-black text-gray-400">Duration</span></div><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Required reason" className="min-h-28 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs outline-none"/><div className="flex gap-2"><Btn disabled={saving||!userId.trim()||!reason.trim()} onClick={()=>void apply()}>Apply action</Btn><Btn disabled={!userId.trim()} onClick={()=>void load()}>Load history</Btn></div></div></Card><Card><div className="flex items-center gap-2"><Shield size={17}/><div><h3 className="text-sm font-black">Enforcement history</h3><p className="text-[10px] text-gray-400">Reversible state changes are visible alongside the original reason.</p></div></div><div className="mt-4 space-y-2">{history.map(a=><div key={a.id} className="rounded-2xl bg-gray-50 p-3"><div className="flex items-center gap-2"><b className="text-[10px]">{a.action}</b><span className="text-[9px] text-gray-400">{fmt(a.createdAt)}</span></div><p className="mt-1 text-[10px] text-gray-600">{a.reason}</p><p className="mt-1 text-[9px] text-gray-400">{a.expiresAt ? "Expires " + fmt(a.expiresAt) : "No expiry"}{a.reversedAt ? " · Reversed " + fmt(a.reversedAt) : ""}</p></div>)}{!history.length?<p className="text-xs text-gray-400">Enter a user ID to inspect enforcement history.</p>:null}</div></Card></div>;
}

function Risk({ onNotice }: { onNotice: (s: string) => void }) {
  const [userId,setUserId]=useState("");const [result,setResult]=useState<any>(null);const [queue,setQueue]=useState<any[]>([]);
  async function inspect(){if(!userId.trim())return;const r=await fetch("/api/admin/risk?userId="+encodeURIComponent(userId.trim()),{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not calculate risk.");return;}setResult(j);}
  async function load(){const r=await fetch("/api/admin/risk",{cache:"no-store"});const j=await r.json();if(r.ok)setQueue(j.risk??[]);else onNotice(j.error??"Could not load risk queue.");}
  useEffect(()=>{void load();},[]);
  return <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="Inspect user risk by ID"/><Btn onClick={()=>void inspect()}>Analyze</Btn></div>{result?<Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="grid size-16 place-items-center rounded-2xl bg-[#eeebff] text-2xl font-black text-[#5a4be8]">{result.risk.score}</div><div><p className="text-sm font-black">{result.user.name} <span className="text-gray-400">@{result.user.username??"member"}</span></p><p className="mt-1 text-xs text-gray-500">Risk level: <b>{result.risk.level}</b></p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(result.risk.factors??{}).map(([k,v])=><span key={k} className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-bold text-gray-500">{k}: {String(v)}</span>)}</div></div></div></Card>:null}<Card><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Highest reported accounts</h3><p className="text-[10px] text-gray-400">A triage signal, not an automatic enforcement decision.</p></div><Btn onClick={()=>void load()}>Refresh</Btn></div><div className="mt-4 space-y-2">{queue.map((row:any)=><div key={row.user.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"><div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={15}/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{row.user.name}</p><p className="text-[10px] text-gray-400">@{row.user.username??"member"} · {row.reports7d} reports / 7d</p></div><span className="text-lg font-black">{row.score}</span></div>)}{!queue.length?<p className="text-xs text-gray-400">No elevated report-based accounts found.</p>:null}</div></Card></div>;
}

function SocialGraph({ onNotice }: { onNotice: (s: string) => void }) {
  const [userId,setUserId]=useState("");const [targetId,setTargetId]=useState("");const [list,setList]=useState("summary");const [data,setData]=useState<any>(null);
  async function load(){if(!userId.trim())return;const r=await fetch("/api/admin/social-graph?userId="+encodeURIComponent(userId.trim())+"&list="+list,{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not load social graph.");return;}setData(j);}
  async function act(action:string){const r=await fetch("/api/admin/social-graph",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,userId:userId.trim(),targetId:targetId.trim()})});const j=await r.json();if(!r.ok){onNotice(j.error??"Relationship action failed.");return;}onNotice("Social relationship updated and audited.");setTargetId("");void load();}
  const rows=data?.followers??data?.following??data?.friends??data?.blocked??[];
  return <div className="space-y-4"><Card><div className="grid gap-2 md:grid-cols-[1fr_160px_auto]"><Input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="User ID"/><Select value={list} onChange={e=>setList(e.target.value)}><option>summary</option><option>followers</option><option>following</option><option>friends</option><option>blocked</option></Select><Btn onClick={()=>void load()}>Inspect</Btn></div></Card>{data?.counts?<Card><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(data.counts).map(([key,value])=><div key={key} className="rounded-2xl bg-gray-50 p-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-gray-400">{key}</p><p className="mt-2 text-xl font-black">{String(value)}</p></div>)}</div></Card>:null}<Card><div className="space-y-2">{rows.map((row:any)=>{const person=row.follower??row.following??row.friend??row.blocked??row;return <div key={person.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"><div className="grid size-9 place-items-center rounded-full bg-white"><Users size={14}/></div><div className="min-w-0 flex-1"><p className="text-xs font-black">{person.name}</p><p className="text-[10px] text-gray-400">@{person.username??"member"} · {fmt(row.createdAt??row.updatedAt)}</p></div><Input value={targetId} onChange={e=>setTargetId(e.target.value)} placeholder="Target ID" className="hidden w-32 sm:block"/>{list==="following"?<Btn danger onClick={()=>void act("UNFOLLOW")}>Unfollow</Btn>:null}{list==="friends"?<Btn danger onClick={()=>void act("REMOVE_FRIEND")}>Remove</Btn>:null}{list==="followers"?<Btn danger onClick={()=>{setTargetId(person.id);void act("UNFOLLOW")}}>Remove follow</Btn>:null}{list==="blocked"?<Btn onClick={()=>void act("REMOVE_BLOCK")}>Unblock</Btn>:null}</div>})}{!rows.length?<p className="p-8 text-center text-xs text-gray-400">Choose a user and relationship list to inspect.</p>:null}</div></Card></div>;
}

function Integrity({ onNotice }: { onNotice: (s: string) => void }) {
  const [data,setData]=useState<any>(null);const [busy,setBusy]=useState(false);
  async function scan(){const r=await fetch("/api/admin/integrity",{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Integrity scan failed.");return;}setData(j);}
  async function fix(action:string){setBusy(true);try{const r=await fetch("/api/admin/integrity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});const j=await r.json();if(!r.ok){onNotice(j.error??"Integrity repair failed.");return;}onNotice("Integrity repair completed: "+j.count+" records.");await scan();}finally{setBusy(false);}}
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Data integrity center</h3><p className="text-[10px] text-gray-400">Scan safe-to-check relational and lifecycle conditions before they become user-facing bugs.</p></div><Btn onClick={()=>void scan()}>Run scan</Btn></div><Card><div className="space-y-2">{(data?.issues??[]).map((issue:any)=><div key={issue.key} className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-black">{issue.key.replaceAll("_"," ")}</p><p className="mt-1 text-[10px] text-gray-400">{issue.severity} · {issue.count} affected</p></div>{issue.fix?<Btn disabled={busy||issue.count===0} onClick={()=>void fix(issue.fix)}>Safe fix</Btn>:<span className="text-[9px] font-black text-amber-700">Review manually</span>}</div>)}{!data?<p className="p-8 text-center text-xs text-gray-400">Run an integrity scan to begin.</p>:null}</div></Card></div>;
}

function Limits({ onNotice }: { onNotice: (s: string) => void }) {
  const [data,setData]=useState<any>(null);
  async function load(){const r=await fetch("/api/admin/rate-limits",{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not load rate limits.");return;}setData(j);}
  useEffect(()=>{void load();},[]);
  async function reset(key:string){const r=await fetch("/api/admin/rate-limits?key="+encodeURIComponent(key),{method:"DELETE"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not reset rate limit.");return;}onNotice("Rate limit bucket reset.");void load();}
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">Rate-limit intelligence</h3><p className="text-[10px] text-gray-400">Inspect currently active buckets and administrator login throttles.</p></div><Btn onClick={()=>void load()}>Refresh</Btn></div><Card><div className="space-y-2">{(data?.buckets??[]).map((row:any)=><div key={row.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"><Activity size={14}/><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black">{row.key}</p><p className="text-[9px] text-gray-400">{row.count} requests · resets {fmt(row.resetAt)}</p></div><Btn onClick={()=>void reset(row.key)}>Reset</Btn></div>)}{!(data?.buckets?.length)?<p className="text-xs text-gray-400">No active runtime buckets.</p>:null}</div></Card><Card><h3 className="text-sm font-black">Admin login throttles</h3><div className="mt-3 space-y-2">{(data?.adminAttempts??[]).map((row:any)=><div key={row.id} className="flex items-center justify-between rounded-2xl bg-gray-50 p-3 text-[10px]"><span className="truncate">{row.key}</span><b>{row.count} attempts</b></div>)}{!(data?.adminAttempts?.length)?<p className="text-xs text-gray-400">No active admin login throttles.</p>:null}</div></Card></div>;
}

function Appeals({ onNotice }: { onNotice: (s: string) => void }) {
  const [status,setStatus]=useState("PENDING");const [items,setItems]=useState<any[]>([]);
  async function load(){const r=await fetch("/api/admin/appeals?status="+status,{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not load appeals.");return;}setItems(j.appeals??[]);}
  useEffect(()=>{void load();},[status]);
  async function decide(id:string,next:string){const r=await fetch("/api/admin/appeals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:next,reviewerNote:"Reviewed in Admin 4.0."})});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not review appeal.");return;}onNotice("Appeal reviewed and audited.");void load();}
  return <div className="space-y-4"><div className="flex gap-2 overflow-x-auto">{["PENDING","APPROVED","REJECTED","PARTIAL"].map(x=><button key={x} type="button" onClick={()=>setStatus(x)} className={"shrink-0 rounded-xl px-3 py-2 text-[9px] font-black "+(status===x?"bg-gray-950 text-white":"bg-gray-50 text-gray-500")}>{x}</button>)}</div><Card><div className="space-y-2">{items.map(item=><div key={item.id} className="rounded-2xl bg-gray-50 p-3 sm:p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.user?.name??"User"}</p><p className="text-[9px] text-gray-400">@{item.user?.username??"member"} · {fmt(item.createdAt)}</p><p className="mt-2 text-[11px] text-gray-600">{item.reason}</p>{item.evidence?<p className="mt-2 text-[10px] text-gray-400">Evidence: {item.evidence}</p>:null}</div>{status==="PENDING"?<div className="flex flex-wrap gap-2"><Btn onClick={()=>void decide(item.id,"APPROVED")}>Uphold</Btn><Btn onClick={()=>void decide(item.id,"PARTIAL")}>Partial</Btn><Btn danger onClick={()=>void decide(item.id,"REJECTED")}>Reject</Btn></div>:null}</div></div>)}{!items.length?<p className="p-8 text-center text-xs text-gray-400">No appeals in this state.</p>:null}</div></Card></div>;
}

function Approvals({ onNotice }: { onNotice: (s: string) => void }) {
  const [status,setStatus]=useState("PENDING");const [items,setItems]=useState<any[]>([]);const [form,setForm]=useState({action:"CRITICAL_OPERATION",targetType:"SYSTEM",targetId:"",reason:""});
  async function load(){const r=await fetch("/api/admin/approvals?status="+status,{cache:"no-store"});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not load approvals.");return;}setItems(j.approvals??[]);}
  useEffect(()=>{void load();},[status]);
  async function create(){const r=await fetch("/api/admin/approvals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not create approval request.");return;}onNotice("Approval request created.");setForm({action:"CRITICAL_OPERATION",targetType:"SYSTEM",targetId:"",reason:""});void load();}
  async function decide(id:string,next:"APPROVED"|"REJECTED"){const r=await fetch("/api/admin/approvals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:next,decisionNote:"Reviewed in Admin 4.0."})});const j=await r.json();if(!r.ok){onNotice(j.error??"Could not decide approval.");return;}onNotice("Approval decision audited.");void load();}
  return <div className="space-y-4"><Card><h3 className="text-sm font-black">Create second-admin approval</h3><p className="mt-1 text-[10px] text-gray-400">Use for critical operations that should not be performed by one person without review.</p><div className="mt-3 grid gap-2 md:grid-cols-3"><Input value={form.action} onChange={e=>setForm({...form,action:e.target.value})} placeholder="Action"/><Input value={form.targetType} onChange={e=>setForm({...form,targetType:e.target.value})} placeholder="Target type"/><Input value={form.targetId} onChange={e=>setForm({...form,targetId:e.target.value})} placeholder="Target ID"/><textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Reason" className="min-h-20 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs outline-none md:col-span-2"/><div><Btn disabled={!form.targetId.trim()||!form.reason.trim()} onClick={()=>void create()}>Request approval</Btn></div></div></Card><div className="flex gap-2">{["PENDING","APPROVED","REJECTED"].map(x=><button key={x} type="button" onClick={()=>setStatus(x)} className={"rounded-xl px-3 py-2 text-[9px] font-black "+(status===x?"bg-gray-950 text-white":"bg-gray-50 text-gray-500")}>{x}</button>)}</div><Card><div className="space-y-2">{items.map(item=><div key={item.id} className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.action} · {item.targetType}</p><p className="text-[10px] text-gray-400">{item.targetId} · {fmt(item.createdAt)}</p><p className="mt-1 text-[10px] text-gray-600">{item.reason}</p></div>{status==="PENDING"?<div className="flex gap-2"><Btn onClick={()=>void decide(item.id,"APPROVED")}>Approve</Btn><Btn danger onClick={()=>void decide(item.id,"REJECTED")}>Reject</Btn></div>:null}</div>)}{!items.length?<p className="p-8 text-center text-xs text-gray-400">No approval requests.</p>:null}</div></Card></div>;
}
