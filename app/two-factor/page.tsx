"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function verify(){
    if(code.length!==6||busy)return;
    setBusy(true);setError("");
    const result=await authClient.twoFactor.verifyTotp({code,trustDevice:true});
    if(result.error){setError(result.error.message??"Invalid authentication code.");setBusy(false);return;}
    router.replace("/home");
  }

  return <main className="grid min-h-screen place-items-center bg-gray-50 px-4">
    <section className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-7 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Two-factor authentication</p>
      <h1 className="mt-2 text-2xl font-black">Verify your sign-in</h1>
      <p className="mt-2 text-sm leading-6 text-gray-500">Enter the 6-digit code from your authenticator app.</p>
      <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mt-6 h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 text-center text-2xl font-black tracking-[.4em] outline-none focus:bg-white" placeholder="000000"/>
      {error?<p role="alert" className=¶»§q«^