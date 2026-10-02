"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronLeft, MessageSquare, Search, Shield, UserRound } from "lucide-react";

type Conversation = {
  id: string; title: string | null; isGroup: boolean; updatedAt: string;
  members: { userId: string; user: { id: string; name: string; username: string | null; image: string | null } }[];
  messages: { content: string; createdAt: string; senderId: string }[];
};

type Message = { id: string; content: string; createdAt: string; deletedAt: string | null; sender: { id: string; name: string; username: string | null; image: string | null } };

function Card({children,className=""}:{children:React.ReactNode;className?:string}) {
  return <section className={"rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(31,26,64,0.05)] "+className}>{children}</section>;
}
function initials(name:string){return name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}

export function AdminInspection() {
  const [tab,setTab]=useState<"messages"|"activity">("messages");
  const [query,setQuery]=useState("");
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [selected,setSelected]=useState<Conversation|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [userId,setUserId]=useState("");
  const [userQuery,setUserQuery]=useState("");
  const [userResults,setUserResults]=useState<any[]>([]);
  const [activity,setActivity]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function loadConversations(){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/admin/messages?q="+encodeURIComponent(query),{cache:"no-store"});
      const j=await r.json(); if(!r.ok) throw new Error(j.error??"Could not load conversations.");
      setConversations(j.conversations??[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not load conversations.");}
    finally{setLoading(false)}
  }

  useEffect(()=>{ if(tab==="messages") void loadConversations(); },[tab,query]);

  async function openConversation(id:string){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/admin/messages?conversationId="+encodeURIComponent(id),{cache:"no-store"});
      const j=await r.json(); if(!r.ok) throw new Error(j.error??"Could not load messages.");
      setSelected(j.conversation);setMessages(j.messages??[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not load messages.");}
    finally{setLoading(false)}
  }

  async function findUsers(){
    const query=userQuery.trim();
    if(query.length<2){setUserResults([]);return;}
    setError("");
    try{
      const r=await fetch("/api/admin/users?take=8&q="+encodeURIComponent(query),{cache:"no-store"});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error??"Could not search users.");
      setUserResults(j.users??[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not search users.");}
  }

  async function loadActivity(){
    if(!userId.trim()) return;
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/admin/activity?userId="+encodeURIComponent(userId.trim()),{cache:"no-store"});
      const j=await r.json(); if(!r.ok) throw new Error(j.error??"Could not load activity.");
      setActivity(j);
    }catch(e){setError(e instanceof Error?e.message:"Could not load activity.");}
    finally{setLoading(false)}
  }

  const navTabs=[["messages","Messages",MessageSquare],["activity","User activity",Activity]] as const;
  if(selected) return <div className="space-y-5">
    <button onClick={()=>setSelected(null)} className="flex items-center gap-1 text-xs font-black text-gray-500 hover:text-gray-950"><ChevronLeft size={15}/> Back to conversations</button>
    <Card>
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-600">{initials(selected.members.map(m=>m.user.name).join(" "))}</span><div><h2 className="text-sm font-black">{selected.title??(selected.members.length>2?selected.members.map(m=>m.user.name).join(", "):selected.members.map(m=>m.user.name).join(" & "))}</h2><p className="text-[11px] text-gray-400">{selected.members.length} member{selected.members.length===1?"":"s"} · Admin view access is recorded</p></div></div>
    </Card>
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-[10px] font-black uppercase tracking-[.12em] text-gray-400">Message history</div>
      <div className="max-h-[620px] overflow-y-auto p-5 space-y-3">
        {loading?<p className="text-xs text-gray-400">Loading messages…</p>:messages.length?messages.map(m=><div key={m.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-gray-100 text-[9px] font-black">{initials(m.sender.name)}</span><span className="text-xs font-black">{m.sender.name}</span><span className="text-[10px] text-gray-400">@{m.sender.username??"member"}</span></div><time className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</time></div><p className={"mt-3 whitespace-pre-wrap text-sm leading-6 "+(m.deletedAt?"text-gray-400 italic":"text-gray-700")}>{m.deletedAt?"Message deleted":m.content}</p></div>):<p className="py-8 text-center text-xs text-gray-400">No messages in this conversation.</p>}
      </div>
    </Card>
  </div>;

  return <div className="space-y-5">
    <Card><div className="flex flex-wrap gap-2">{navTabs.map(([key,label,Icon])=><button key={key} onClick={()=>{setTab(key);setError("");setActivity(null)}} className={"flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black "+(tab===key?"bg-[#eeebff] text-[#5a4be8]":"text-gray-500 hover:bg-gray-50")}><Icon size={15}/>{label}</button>)}</div></Card>
    {error?<div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">{error}</div>:null}
    {tab==="messages"?<><Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black">User messages</h2><p className="mt-1 text-xs text-gray-400">Read conversation history. Opening a conversation is recorded in the admin audit log.</p></div><div className="relative sm:ml-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search user or email" className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#a79dff] sm:w-72"/></div></div></Card>
    <Card className="!p-0 overflow-hidden"><div className="divide-y divide-gray-100">{loading?<p className="p-8 text-center text-xs text-gray-400">Loading conversations…</p>:conversations.length?conversations.map(c=><button key={c.id} onClick={()=>void openConversation(c.id)} className="flex w-full items-center gap-4 p-5 text-left hover:bg-gray-50"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-black text-white">{initials(c.members.map(m=>m.user.name).join(" "))}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{c.title??c.members.map(m=>m.user.name).join(" · ")}</span><span className="mt-1 block truncate text-[11px] text-gray-400">{c.messages[0]?.content??"No messages yet"}</span><span className="mt-1 block text-[10px] text-gray-400">{c.messages[0]?.createdAt?new Date(c.messages[0].createdAt).toLocaleString():"No activity"}</span></span><span className="text-[10px] font-black text-[#5a4be8]">View</span></button>):<p className="p-8 text-center text-xs text-gray-400">No conversations found.</p>}</div></Card></>:null}
    {tab==="activity"?<><Card><h2 className="text-sm font-black">Inspect a user</h2><p className="mt-1 text-xs text-gray-400">Search by name, username or email, then inspect account activity.</p><div className="mt-4 flex gap-2"><input value={userQuery} onChange={e=>{setUserQuery(e.target.value);void findUsers()}} onKeyDown={e=>{if(e.key==="Enter")void findUsers()}} placeholder="Search name, username or email" className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs outline-none"/><button type="button" onClick={()=>void findUsers()} className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700">Find</button></div>{userResults.length?<div className="mt-3 grid gap-2 sm:grid-cols-2">{userResults.map((user:any)=><button type="button" key={user.id} onClick={()=>{setUserId(user.id);setUserQuery(user.name+" @"+(user.username??"member"));setUserResults([]);void loadActivity()}} className="rounded-2xl bg-gray-50 p-3 text-left hover:bg-gray-100"><p className="text-xs font-black">{user.name}</p><p className="mt-1 text-[10px] text-gray-400">@{user.username??"member"} · {user.email}</p></button>)}</div>:null}</Card>
    {activity?<ActivityView data={activity}/>:<Card><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><UserRound size={18}/></span><div><p className="text-sm font-black">User activity timeline</p><p className="mt-1 text-xs leading-5 text-gray-400">Search for a user above to open their activity timeline.</p></div></div></Card>}</>:null}
  </div>;
}

function ActivityView({data}:{data:any}){
 const sections=[["Posts",data.posts,"createdAt"],["Comments",data.comments,"createdAt"],["Likes",data.likes,"createdAt"],["Follows",data.follows,"createdAt"],["Friend requests",data.friends,"updatedAt"],["Notifications",data.notifications,"createdAt"],["Stories",data.stories,"createdAt"],["Sessions",data.sessions,"createdAt"]];
 return <div className="space-y-5">
  <Card><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-600">{initials(data.user.name)}</span><div><h2 className="text-sm font-black">{data.user.name}</h2><p className="text-xs text-gray-400">@{data.user.username??"member"} · {data.user.email}</p></div><span className="ml-auto rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black">{data.user.role}</span></div></Card>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Posts",data.posts.length],["Comments",data.comments.length],["Likes",data.likes.length],["Notifications",data.notifications.length]].map(([l,v])=><Card key={String(l)}><p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{l}</p><p className="mt-2 text-2xl font-black">{String(v)}</p><p className="mt-1 text-[10px] text-gray-400">recent records</p></Card>)}</div>
  <Card><div className="flex items-center gap-2"><Shield size={16}/><h2 className="text-sm font-black">Recent activity</h2></div><div className="mt-4 space-y-2">{sections.flatMap(([label,items,key])=>(items as any[]).slice(0,8).map((item:any,i)=><div key={String(label)+"-"+i} className="rounded-2xl bg-gray-50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-wider text-violet-600">{label}</span><time className="text-[10px] text-gray-400">{new Date(item[key as string]).toLocaleString()}</time></div><p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.content??item.type??(item.status?"Friend request "+item.status:"Activity recorded")}</p></div>))}</div></Card>
 </div>;
}
