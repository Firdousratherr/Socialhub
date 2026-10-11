"use client";

import { fetchWithTimeout } from "@/lib/client-fetch";

import { useEffect, useState, useCallback } from "react";
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
  const [userResults,setUserResults]=useS¶»§q«^