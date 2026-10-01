"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AdminPanel } from "@/components/admin-panel";
import { MobileMenu } from "@/components/mobile-menu";
import {
  ArrowLeft, ArrowRight, AtSign, BarChart3, Bell, Bookmark, Camera, Check,
  ChevronRight, CircleHelp, Compass, Globe2, Heart, Image as ImageIcon,
  KeyRound, Lock, LogIn, Mail, MessageCircle, MoreHorizontal, Pencil, Plus,
  Search, Send, Settings, Shield, Sparkles, Trash2, UserPlus, Users, X
} from "lucide-react";

type Screen = { kind: string; username?: string; section?: string; search?: string };

const colors = [
  "from-violet-500 to-sky-400",
  "from-fuchsia-500 to-orange-400",
  "from-emerald-400 to-cyan-500",
  "from-amber-400 to-rose-500",
];

const people = [
  ["NP", "Nora Patel", "@norapatel", "12 mutuals"],
  ["DK", "Dev Kapoor", "@devk", "8 mutuals"],
  ["ZS", "Zoya Shah", "@zoyas", "5 mutuals"],
  ["AK", "Aarav Khan", "@aaravk", "21 mutuals"],
];

function Avatar({ initials, color = colors[0], size = "md" }: { initials: string; color?: string; size?: "sm"|"md"|"lg"|"xl" }) {
  const sizes = { sm: "size-8 text-[10px]", md: "size-10 text-xs", lg: "size-14 text-sm", xl: "size-24 text-2xl" };
  return <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${color} ${sizes[size]} font-black text-white shadow-sm`}>{initials}</div>;
}

function Page({
  eyebrow,
  title,
  subtitle,
  action,
  fallbackHref = "/home",
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  fallbackHref?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <main className="min-h-screen pb-8">
      <div className="mx-auto max-w-[1100px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button type="button" onClick={goBack} className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50" aria-label="Go back">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc]">{eyebrow}</p> : null}
              <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-gray-950 sm:text-4xl">{title}</h1>
              {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <MobileMenu />
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`social-card rounded-3xl p-5 ${className}`}>{children}</section>;
}

function Auth({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify-signup" | "forgot" | "forgot-verify">("form");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendSignupOtp() {
    if (!email.trim() || cooldown) return;
    setLoading(true); setError("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "email-verification" });
      if (result.error) throw new Error(result.error.message || "Could not send a new verification code.");
      setCooldown(30); setNotice("A fresh verification code has been sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send a new verification code.");
    } finally { setLoading(false); }
  }

  async function verifySignupOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: otp.trim() });
      if (result.error) throw new Error(result.error.message || "That code is invalid or expired.");
      const signIn = await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/home" });
      if (signIn.error) throw new Error(signIn.error.message || "Email verified, but sign-in could not be completed.");
      router.push("/home"); router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Verification failed. Please try again.");
    } finally { setLoading(false); }
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await authClient.emailOtp.requestPasswordReset({ email: email.trim() });
      if (result.error) throw new Error(result.error.message || "Could not start password recovery.");
      setStep("forgot-verify"); setOtp(""); setCooldown(30);
      setNotice("Check your email for a 6-digit password reset code.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start password recovery.");
    } finally { setLoading(false); }
  }

  async function resendPasswordReset() {
    if (cooldown || loading) return;
    setLoading(true); setError("");
    try {
      const result = await authClient.emailOtp.requestPasswordReset({ email: email.trim() });
      if (result.error) throw new Error(result.error.message || "Could not send a new reset code.");
      setCooldown(30); setNotice("A fresh reset code has been sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send a new reset code.");
    } finally { setLoading(false); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return;
    if (newPassword.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await authClient.emailOtp.resetPassword({ email: email.trim(), otp: otp.trim(), password: newPassword });
      if (result.error) throw new Error(result.error.message || "That code is invalid or expired.");
      setStep("form"); setPassword(""); setNewPassword(""); setOtp("");
      setNotice("Password updated. You can now sign in with your new password.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reset your password.");
    } finally { setLoading(false); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const result = signup
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: "/home" })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/home" });
      if (result.error) { setError(result.error.message || "Authentication failed. Please try again."); return; }
      if (signup) {
        setStep("verify-signup"); setOtp(""); setCooldown(30);
        setNotice("We sent a 6-digit verification code to your email.");
        return;
      }
      router.push("/home"); router.refresh();
    } catch {
      setError("We could not reach the authentication service. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  function resetAuthView() {
    setStep("form"); setError(""); setNotice(""); setOtp(""); setNewPassword(""); setCooldown(0);
  }

  const title = step === "verify-signup" ? "Verify your email."
    : step === "forgot" ? "Recover your account."
    : step === "forgot-verify" ? "Create a new password."
    : signup ? "Join Socialhub today." : "Sign in to Socialhub.";
  const subtitle = step === "verify-signup" ? "Enter the code we sent to " + email + "."
    : step === "forgot" ? "We’ll send a secure 6-digit code to your email."
    : step === "forgot-verify" ? "Enter the code from your email and choose a new password."
    : signup ? "Build your profile and start finding your people." : "Pick up where you left off.";

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
        <section className="hidden bg-[radial-gradient(circle_at_top,#7d70ff,transparent_55%),linear-gradient(145deg,#171426,#30275d)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-white/10"><Sparkles size={18}/></span><span className="font-black">Socialhub</span></Link>
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-white/50">Connect. Share. Belong.</p><h1 className="mt-5 max-w-md text-5xl font-black leading-[.96] tracking-[-.055em]">A social space that feels like yours.</h1><p className="mt-6 max-w-md text-sm leading-7 text-white/65">Keep your people close, share the moments that matter, and discover conversations worth having.</p></div>
          <div className="grid grid-cols-3 gap-3">{[["12.4k","members"],["48k","posts"],["9.8k","daily chats"]].map(x=><div key={x[1]} className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="font-black">{x[0]}</p><p className="text-[10px] text-white/50">{x[1]}</p></div>)}</div>
        </section>

        <section className="flex items-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7 flex items-center justify-between lg:hidden"><Link href="/" className="flex items-center gap-2 font-black"><span className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white"><Sparkles size={17}/></span>Socialhub</Link><Link href="/" className="text-xs font-bold text-gray-500">Home</Link></div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#6d5dfc]">{step === "verify-signup" ? "Email verification" : step.startsWith("forgot") ? "Account recovery" : signup ? "Create your account" : "Welcome back"}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">{title}</h2><p className="mt-2 text-sm text-gray-500">{subtitle}</p>

            {step === "verify-signup" ? (
              <form onSubmit={verifySignupOtp} className="mt-7 space-y-4">
                <div className="rounded-3xl border border-[#ddd8ff] bg-[#f8f7ff] p-5 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Mail size={20}/></div><p className="mt-3 text-sm font-black text-gray-900">Check your inbox</p><p className="mt-1 text-xs leading-5 text-gray-500">The code is valid for 10 minutes and has a limited number of attempts.</p></div>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">6-digit code</span><input value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-center text-2xl font-black tracking-[.45em] outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="000000"/></label>
                {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">{notice}</div> : null}
                <button type="submit" disabled={loading || otp.length !== 6} className="h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Verifying…" : "Verify & continue"}</button>
                <div className="flex items-center justify-between text-xs font-bold"><button type="button" onClick={()=>void sendSignupOtp()} disabled={loading || cooldown>0} className="text-[#5a4be8] disabled:text-gray-400">{cooldown>0 ? "Resend in " + cooldown + "s" : "Resend code"}</button><button type="button" onClick={resetAuthView} className="text-gray-500">Back</button></div>
              </form>
            ) : step === "forgot" ? (
              <form onSubmit={requestPasswordReset} className="mt-7 space-y-4">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Account email</span><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="you@example.com"/></div></label>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs leading-5 text-gray-500">We’ll send a 6-digit code that expires in 10 minutes. Never share your code with anyone.</div>
                {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
                <button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white disabled:opacity-50">{loading ? "Sending code…" : "Send reset code"}</button>
                <button type="button" onClick={resetAuthView} className="w-full text-xs font-black text-gray-500">Back to sign in</button>
              </form>
            ) : step === "forgot-verify" ? (
              <form onSubmit={resetPassword} className="mt-7 space-y-4">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">6-digit reset code</span><input value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-center text-2xl font-black tracking-[.45em] outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="000000"/></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">New password</span><input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="At least 8 characters"/></label>
                {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">{notice}</div> : null}
                <button type="submit" disabled={loading || otp.length !== 6} className="h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Updating password…" : "Set new password"}</button>
                <div className="flex items-center justify-between text-xs font-bold"><button type="button" onClick={()=>void resendPasswordReset()} disabled={loading || cooldown>0} className="text-[#5a4be8] disabled:text-gray-400">{cooldown>0 ? "Resend in " + cooldown + "s" : "Send a new code"}</button><button type="button" onClick={()=>setStep("forgot")} className="text-gray-500">Change email</button></div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                  {signup && <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Full name</span><input value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" required className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Your name"/></label>}
                  <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Email</span><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="you@example.com"/></div></label>
                  {signup && <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-[11px] leading-5 text-gray-500"><span className="font-black text-gray-700">Username:</span> @{email.split("@")[0] || "yourname"} · You can change it from your profile.</div>}
                  <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Password</span><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17}/><input type={show ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={8} required className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-20 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="••••••••"/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-gray-500">{show ? "Hide" : "Show"}</button></div></label>
                  {!signup && <div className="flex items-center justify-between text-xs font-semibold text-gray-500"><label className="flex items-center gap-2"><input type="checkbox" className="accent-[#6d5dfc]"/>Remember me</label><button type="button" onClick={()=>{setError("");setNotice("");setStep("forgot");}} className="font-black text-[#5a4be8]">Forgot password?</button></div>}
                  {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
                  {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">{notice}</div> : null}
                  <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"><LogIn size={17}/>{loading ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
                  <button type="button" onClick={()=>{void (async()=>{setError("");setNotice("");setLoading(true);try{const result=await authClient.signIn.social({provider:"google",callbackURL:"/home"});if(result.error){setError(result.error.message||"Google sign-in failed.");setLoading(false);}}catch{setError("We could not start Google sign-in. Please try again.");setLoading(false);}})();}} disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"><Globe2 size={17}/>{loading ? "Connecting to Google…" : "Continue with Google"}</button>
                </form>
                <p className="mt-7 text-center text-sm text-gray-500">{signup ? <>Already have an account? <Link href="/login" className="font-black text-[#5a4be8]">Sign in</Link></> : <>New to Socialhub? <Link href="/signup" className="font-black text-[#5a4be8]">Create an account</Link></>}</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type ProfileData = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  bio: string | null;
  image: string | null;
  coverImage: string | null;
  website: string | null;
  location: string | null;
  isPrivate: boolean;
  role: "USER" | "MODERATOR" | "ADMIN";
  createdAt: string;
  _count: { posts: number; followers: number; following: number };
  visibleCounts?: { posts: number; followers: number; following: number };
  isFollowing?: boolean;
  isFriend?: boolean;
  posts?: Array<{
    id: string;
    content: string | null;
    mediaUrl: string | null;
    createdAt: string;
    _count: { likes: number; comments: number };
  }>;
};

function Profile({ username = "firdous" }: { username?: string }) {
  const { data: session } = authClient.useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [following, setFollowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState("");
  const [profileTab, setProfileTab] = useState<"posts" | "photos" | "friends">("posts");
  const [friends, setFriends] = useState<Array<{ id: string; name: string; username: string | null; image: string | null; bio: string | null }>>([]);
  const [form, setForm] = useState({
    name: "Firdous Rather",
    username,
    bio: "Building products, learning every day, and sharing the journey.",
    location: "Jammu & Kashmir",
    website: "",
    isPrivate: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        let next: ProfileData | null = null;
        let owner = false;

        if (session?.user) {
          const ownResponse = await fetch("/api/profile", { cache: "no-store" });
          const ownJson = await ownResponse.json().catch(() => ({}));
          if (ownResponse.ok && ownJson.profile?.username === username) {
            next = ownJson.profile as ProfileData;
            owner = true;
          }
        }

        if (!next) {
          const response = await fetch("/api/users/" + encodeURIComponent(username), { cache: "no-store" });
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? "Could not load profile.");
          next = json.profile as ProfileData;
        }

        if (cancelled || !next) return;
        setProfile(next);
        setIsOwner(owner);
        setFollowing(Boolean(next.isFollowing));
        setForm({
          name: next.name,
          username: next.username ?? "",
          bio: next.bio ?? "",
          location: next.location ?? "",
          website: next.website ?? "",
          isPrivate: Boolean(next.isPrivate),
        });
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load profile.");
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, username]);

  useEffect(() => {
    if (!isOwner || profileTab !== "friends") return;
    let cancelled = false;
    void fetch("/api/friends", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load friends.");
        if (!cancelled) setFriends(json.friends ?? []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load friends.");
      });
    return () => { cancelled = true; };
  }, [isOwner, profileTab]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user || saving) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update profile.");
      setProfile((json.profile as ProfileData) ?? profile);
      setEditing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadProfileImage(file: File, target: "avatar" | "cover") {
    if (!session?.user || uploading) return;
    setUploading(target);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(uploadJson.error ?? "Could not upload image.");

      const field = target === "avatar" ? "image" : "coverImage";
      const profileResponse = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: uploadJson.url }),
      });
      const profileJson = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok) throw new Error(profileJson.error ?? "Could not save image.");

      setProfile((current) =>
        current
          ? {
              ...current,
              ...(target === "avatar" ? { image: uploadJson.url } : { coverImage: uploadJson.url }),
            }
          : current,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update profile image.");
    } finally {
      setUploading(null);
    }
  }

  async function shareProfile() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: displayName, text: "View my Socialhub profile", url });
      else { await navigator.clipboard.writeText(url); setError("Profile link copied."); }
    } catch {}
  }

  const displayName = profile?.name ?? form.name;
  const displayUsername = profile?.username ?? form.username ?? username;
  const postCount = profile?.visibleCounts?.posts ?? profile?._count.posts ?? 184;
  const followerCount = profile?.visibleCounts?.followers ?? profile?._count.followers ?? 1800;
  const followingCount = profile?.visibleCounts?.following ?? profile?._count.following ?? 426;
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase() || "SH";

  async function toggleFollow() {
    if (!session?.user || isOwner || !profile) return;
    const response = await fetch("/api/users/" + profile.id + "/follow", { method: following ? "DELETE" : "POST" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error ?? "Could not update follow status.");
      return;
    }
    setFollowing(Boolean(json.following));
  }

  async function reportUser() {
    if (!profile || isOwner) return;
    const reason = window.prompt("Why are you reporting this profile?", "Spam or misleading profile");
    if (!reason?.trim()) return;
    const response = await fetch("/api/users/" + profile.id + "/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (response.ok) setError("Report submitted. Thank you for helping keep Socialhub safe.");
    else setError("Could not submit the report.");
  }

  async function blockUser() {
    if (!profile || isOwner) return;
    if (!window.confirm("Block this user? Their content will no longer appear for you.")) return;
    const response = await fetch("/api/users/" + profile.id + "/block", { method: "POST" });
    if (response.ok) setError("User blocked.");
    else setError("Could not block this user.");
  }

  return <Page eyebrow="Profile" title={`@${displayUsername}`} action={
    isOwner ? (
      <button onClick={() => setEditing((value) => !value)} className="flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white">
        <Pencil size={15}/>{editing ? "Cancel" : "Edit profile"}
      </button>
    ) : session?.user ? (
      <div className="flex gap-2">
        <button onClick={() => void toggleFollow()} className={following ? "h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700" : "h-10 rounded-xl bg-[#6d5dfc] px-4 text-xs font-black text-white"}>
          {following ? "Following" : "Follow"}
        </button>
        <button onClick={() => void reportUser()} className="grid size-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600" aria-label="Report profile"><Shield size={15}/></button>
        <button onClick={() => void blockUser()} className="grid size-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600" aria-label="Block profile"><UserPlus size={15}/></button>
      </div>
    ) : (
      <Link href="/login" className="flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white"><LogIn size={15}/>Sign in</Link>
    )
  }>
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

    <div className="overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)]">
      <div
        className="relative h-48 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.24),transparent_22%),linear-gradient(135deg,#5a4be8,#2e9fe9_55%,#51d3b4)] bg-cover bg-center"
        style={profile?.coverImage ? { backgroundImage: `url("${profile.coverImage}")` } : undefined}
      >
        {isOwner ? (
          <>
            <input
              id="cover-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadProfileImage(file, "cover");
                event.currentTarget.value = "";
              }}
            />
            <label
              htmlFor="cover-upload"
              className="absolute right-4 top-4 grid size-10 cursor-pointer place-items-center rounded-xl bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
              aria-label="Change cover image"
              title={uploading === "cover" ? "Uploading…" : "Change cover image"}
            >
              <Camera size={17}/>
            </label>
            {uploading === "cover" ? <span className="absolute right-4 bottom-4 rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur">Uploading cover…</span> : null}
          </>
        ) : null}
      </div>

      <div className="relative px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
          <div className="relative rounded-full border-4 border-white bg-white">
            {isOwner ? (
              <>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadProfileImage(file, "avatar");
                    event.currentTarget.value = "";
                  }}
                />
                <label htmlFor="avatar-upload" className="block cursor-pointer rounded-full" aria-label="Change profile picture">
                  {profile?.image ? (
                    <img src={profile.image} alt={`${displayName} profile picture`} className="size-24 rounded-full object-cover text-[10px] shadow-sm" />
                  ) : (
                    <Avatar initials={initials} size="xl"/>
                  )}
                </label>
              </>
            ) : profile?.image ? (
              <img src={profile.image} alt={`${displayName} profile picture`} className="size-24 rounded-full object-cover text-[10px] shadow-sm" />
            ) : (
              <Avatar initials={initials} size="xl"/>
            )}
          </div>
          <div className="flex-1 sm:pb-2"><h2 className="text-2xl font-black tracking-[-.04em]">{displayName}</h2><p className="text-sm font-semibold text-gray-400">@{displayUsername}{profile?.location ? ` · ${profile.location}` : ""}</p></div>
          {!isOwner && session?.user ? (
          <button onClick={() => void toggleFollow()} className={following ? "h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700" : "h-10 rounded-xl bg-[#6d5dfc] px-4 text-xs font-black text-white"}>
            {following ? "Following" : "Follow"}
          </button>
        ) : null}
        </div>

        {uploading === "avatar" ? <p className="mt-3 text-[11px] font-bold text-[#5a4be8]">Uploading profile picture…</p> : null}

        {editing ? (
          <form onSubmit={saveProfile} className="mt-6 grid gap-4 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] p-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Display name</span><input value={form.name} onChange={(e)=>setForm((value)=>({...value,name:e.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Username</span><input value={form.username} onChange={(e)=>setForm((value)=>({...value,username:e.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-bold text-gray-600">Bio</span><textarea value={form.bio} onChange={(e)=>setForm((value)=>({...value,bio:e.target.value}))} className="min-h-24 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm"/></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Location</span><input value={form.location} onChange={(e)=>setForm((value)=>({...value,location:e.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Website</span><input type="url" value={form.website} onChange={(e)=>setForm((value)=>({...value,website:e.target.value}))} placeholder="https://example.com" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:col-span-2"><input type="checkbox" checked={form.isPrivate} onChange={(e)=>setForm((value)=>({...value,isPrivate:e.target.checked}))} className="size-4 accent-[#6d5dfc]"/><span><span className="block text-xs font-black text-gray-700">Private account</span><span className="mt-0.5 block text-[11px] text-gray-400">Limit profile posts to you and accepted friends.</span></span></label>
            <div className="flex items-end justify-end sm:col-span-2"><button disabled={saving} type="submit" className="h-11 rounded-xl bg-[#6d5dfc] px-4 text-xs font-black text-white disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div>
          </form>
        ) : (
          <>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-600">{profile?.bio ?? form.bio}</p>
            <div className="mt-5 flex gap-6 text-sm"><span><strong className="font-black">{postCount}</strong> <span className="text-gray-400">posts</span></span><span><strong className="font-black">{followerCount}</strong> <span className="text-gray-400">followers</span></span><span><strong className="font-black">{followingCount}</strong> <span className="text-gray-400">following</span></span></div>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {profile?.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-[#5a4be8] hover:bg-[#eeebff]">{profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : null}
          {profile?.isPrivate ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700">Private account</span> : null}
          <span className="rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-500">Joined {new Date(profile?.createdAt ?? Date.now()).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <button type="button" onClick={() => void shareProfile()} className="rounded-full bg-gray-950 px-3 py-1.5 text-[11px] font-black text-white">Share profile</button>
        </div>
        <div className="mt-7 flex gap-6 border-b border-gray-100 pb-3 text-xs font-black">
          {(["posts","photos","friends"] as const).map((tab) => <button key={tab} type="button" onClick={() => setProfileTab(tab)} className={profileTab === tab ? "border-b-2 border-[#6d5dfc] pb-3 text-[#5a4be8]" : "pb-3 text-gray-400"}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
        </div>
        {profileTab === "friends" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {friends.length ? friends.map((friend) => <Link key={friend.id} href={"/profile/" + encodeURIComponent(friend.username ?? friend.id)} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white">
              {friend.image ? <img src={friend.image} alt="" className="size-11 rounded-full object-cover"/> : <Avatar initials={friend.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()} size="md"/>}
              <span className="min-w-0"><span className="block truncate text-sm font-black">{friend.name}</span><span className="block truncate text-xs text-gray-400">@{friend.username ?? "member"}</span></span>
            </Link>) : <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center"><p className="text-sm font-black">No friends to show yet</p><p className="mt-1 text-xs text-gray-400">Accepted connections will appear here.</p></div>}
          </div>
        ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(profile?.posts ?? []).filter((post) => profileTab === "posts" || Boolean(post.mediaUrl)).length > 0 ? (
            profile?.posts?.map((post) => (
              <article key={post.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  {profile?.image ? <img src={profile.image} alt="" className="size-9 rounded-full object-cover" /> : <Avatar initials={initials} size="sm" />}
                  <div><p className="text-xs font-black">{displayName}</p><p className="text-[11px] text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p></div>
                </div>
                {post.content ? <p className="mt-3 text-sm leading-6 text-gray-600">{post.content}</p> : null}
                {post.mediaUrl ? <img src={post.mediaUrl} alt="" className="mt-4 max-h-72 w-full rounded-xl object-cover" /> : null}
                <div className="mt-4 flex gap-5 text-xs font-semibold text-gray-400">
                  <span className="inline-flex items-center gap-1"><Heart size={14}/> {post._count.likes}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={14}/> {post._count.comments}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <p className="text-sm font-black">{profileTab === "photos" ? "No photos yet" : "No public posts yet"}</p>
              <p className="mt-1 text-xs text-gray-400">{isOwner ? "Share your first post from the home feed." : "This profile has not shared any public posts."}</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  </Page>;
}

type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; username: string | null; image: string | null };
};

type ConversationData = {
  id: string;
  title: string | null;
  isGroup: boolean;
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; name: string; username: string | null; image: string | null };
  }>;
  messages: Array<{ id: string; senderId: string; content: string; createdAt: string }>;
};

function Messages() {
  const { data: session } = authClient.useSession();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      setLoading(true);
      setError("");
      if (!session?.user) {
        setConversations([]);
        setActiveId(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/conversations", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load conversations.");
        if (cancelled) return;
        const next = json.conversations as ConversationData[];
        setConversations(next);
        setActiveId((current) => current && next.some((conversation) => conversation.id === current) ? current : next[0]?.id ?? null);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load conversations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConversations();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!activeId || !session?.user) {
        setMessages([]);
        return;
      }

      try {
        const response = await fetch(`/api/conversations/${activeId}/messages`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load messages.");
        if (!cancelled) setMessages(json.messages as ChatMessage[]);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load messages.");
      }
    }

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeId, session?.user?.id]);

  const filteredConversations = conversations.filter((conversation) => {
    const other = conversation.members.find((member) => member.userId !== session?.user?.id)?.user;
    const haystack = [conversation.title, other?.name, other?.username, ...conversation.messages.map((message) => message.content)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(messageSearch.trim().toLowerCase());
  });

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const activeMember = active?.members.find((member) => member.userId !== session?.user?.id)?.user;
  const activeName = active?.title ?? activeMember?.name ?? "Messages";

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || !session?.user || sending) return;

    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not send message.");
      setMessages((current) => [...current, json.message as ChatMessage]);
      setDraft("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return <Page eyebrow="Messages" title="Your conversations" subtitle="Focused one-to-one and group messaging, designed to be easy to pick back up.">
    {!session?.user ? (
      <div className="mb-5 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">
        Sign in to load your real conversations. The interface stays browsable while you are signed out.
      </div>
    ) : null}
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

    <div className="grid min-h-[620px] overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)] lg:grid-cols-[330px_1fr]">
      <aside className="border-b border-gray-100 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-gray-100 p-4"><h2 className="text-sm font-black">Inbox</h2><button className="social-icon-button"><Pencil size={17}/></button></div>
        <label className="relative m-3 block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} className="h-10 w-full rounded-xl bg-gray-50 pl-10 text-xs font-semibold outline-none focus:bg-white" placeholder="Search messages" aria-label="Search messages"/></label>

        <div className="space-y-1 p-2">
          {loading && session?.user ? (
            [1,2,3].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl p-3"><span className="size-10 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-2/3 animate-pulse rounded bg-gray-100"/></div></div>)
          ) : filteredConversations.length > 0 ? filteredConversations.map((conversation, i) => {
            const other = conversation.members.find((member) => member.userId !== session?.user?.id)?.user;
            const name = conversation.title ?? other?.name ?? "Conversation";
            const preview = conversation.messages[0]?.content ?? "No messages yet";
            return <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${conversation.id===activeId?"bg-[#f4f2ff]":"hover:bg-gray-50"}`}>
              <Avatar initials={(other?.name ?? name).split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} color={colors[i%colors.length]}/>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{name}</p><p className="mt-1 truncate text-[11px] text-gray-400">{preview}</p></div>
            </button>;
          }) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-7 text-center">
              <MessageCircle className="mx-auto text-gray-300" size={22}/>
              <p className="mt-3 text-xs font-black text-gray-700">{messageSearch.trim() ? "No matching conversations" : "No conversations yet"}</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-400">{messageSearch.trim() ? "Try another name or message." : session?.user ? "Your real conversations will appear here." : "Sign in to see your conversations."}</p>
            </div>
                    )}
        </div>
      </aside>

      <section className="flex min-h-[620px] flex-col">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          <Avatar initials={(activeName || "MS").split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} />
          <div className="flex-1"><p className="text-sm font-black">{activeName}</p><p className="text-[11px] text-gray-400">{active ? (active.isGroup ? `${active.members.length} members` : "Direct message") : "Select a conversation"}</p></div>
          <button className="social-icon-button"><Search size={17}/></button><button className="social-icon-button"><MoreHorizontal size={18}/></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {active && messages.length > 0 ? messages.map((message) => {
            const mine = message.senderId === session?.user?.id;
            return <div key={message.id} className={mine ? "flex justify-end" : "flex items-end gap-2"}>
              {!mine ? <Avatar initials={message.sender.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} size="sm"/> : null}
              <div className={mine ? "max-w-[76%] rounded-2xl rounded-br-md bg-[#6d5dfc] px-4 py-3 text-sm leading-6 text-white" : "max-w-[76%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700"}>{message.content}</div>
            </div>;
          }) : (
            <div className="flex h-full min-h-56 items-center justify-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><MessageCircle size={20}/></span><p className="mt-3 text-sm font-black">{active ? "No messages yet" : "Pick a conversation"}</p><p className="mt-1 text-xs text-gray-400">{active ? "Send the first message below." : "Choose a chat from your inbox to start."}</p></div></div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t border-gray-100 p-3">
          <div className="flex items-end gap-2 rounded-2xl bg-gray-50 p-2"><button type="button" className="grid size-10 place-items-center rounded-xl"><Plus size={18}/></button><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={1} disabled={!active || !session?.user || sending} className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder={active ? "Write a message…" : "Select a conversation first"}/><button type="submit" disabled={!active || !draft.trim() || !session?.user || sending} className="grid size-10 place-items-center rounded-xl bg-gray-950 text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={16}/></button></div>
        </form>
      </section>
    </div>
  </Page>;
}
type DiscoverUser = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  isPrivate?: boolean;
  _count: { followers: number; following: number };
};

function Discover({ initialQuery = "" }: { initialQuery?: string }) {
  const { data: session } = authClient.useSession();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/users?q=" + encodeURIComponent(q) + "&take=20", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not search users.");
        if (!cancelled) setResults((json.users ?? []) as DiscoverUser[]);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not search users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(() => {
      void loadUsers();
    }, q ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  async function toggleFollow(user: DiscoverUser) {
    if (!session?.user) {
      window.location.href = "/login";
      return;
    }

    const isFollowing = following.has(user.id);
    const response = await fetch("/api/users/" + user.id + "/follow", {
      method: isFollowing ? "DELETE" : "POST",
    });

    if (response.ok) {
      setFollowing((current) => {
        const next = new Set(current);
        if (isFollowing) next.delete(user.id);
        else next.add(user.id);
        return next;
      });
    } else if (user.isPrivate) {
      const friendResponse = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: user.id }),
      });
      if (!friendResponse.ok) {
        const json = await friendResponse.json().catch(() => ({}));
        setError(json.error ?? "Could not send friend request.");
      }
    }
  }

  return <Page eyebrow="Discover" title="Find your next connection" subtitle="Search people, browse topics, and explore conversations worth joining.">
    <div className="space-y-5">
      <Card>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input value={q} onChange={(e)=>setQ(e.target.value)} className="h-12 w-full rounded-2xl bg-gray-50 pl-11 text-sm font-semibold outline-none focus:bg-white" placeholder="Search people and usernames…"/>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="rounded-xl bg-[#eeebff] px-3.5 py-2 text-xs font-black text-[#5a4be8]">People</button>
          {["Posts","Topics","Communities"].map((x)=><button key={x} className="rounded-xl px-3.5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50">{x}</button>)}
        </div>
      </Card>

      {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <div className="flex justify-between">
            <h2 className="text-sm font-black">{q ? "Search results" : "Suggested people"}</h2>
            <span className="text-xs font-bold text-gray-400">{results.length} people</span>
          </div>
          <div className="mt-4 space-y-4">
            {loading ? [1,2,3].map((item)=><div key={item} className="flex items-center gap-3 p-2"><span className="size-10 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/2 animate-pulse rounded bg-gray-100"/></div></div>) :
            results.map((user, i) => {
              const initials = user.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase();
              const isFollowing = following.has(user.id);
              return <div key={user.id} className="flex items-center gap-3">
                <Link href={"/profile/" + (user.username ?? user.id)}>
                  <Avatar initials={initials} color={colors[i % colors.length]}/>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={"/profile/" + (user.username ?? user.id)} className="block truncate text-xs font-black hover:text-[#5a4be8]">{user.name}</Link>
                  <p className="truncate text-[11px] text-gray-400">@{user.username ?? "member"} · {user._count.followers} followers</p>
                </div>
                <button onClick={()=>void toggleFollow(user)} className={isFollowing ? "grid size-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600" : "grid size-9 place-items-center rounded-xl bg-gray-950 text-white"} aria-label={isFollowing ? "Unfollow" : "Follow"}>
                  {isFollowing ? <Check size={15}/> : <UserPlus size={15}/>}
                </button>
              </div>;
            })}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-black">Trending topics</h2>
          <div className="mt-4 space-y-2">
            {["#BuildInPublic","#WeekendMoments","#DesignTalk","#Creators"].map((x,i)=><Link key={x} href="#" className="flex items-center gap-3 rounded-2xl p-3 hover:bg-gray-50">
              <span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-[10px] font-black text-gray-500">0{i+1}</span>
              <span className="flex-1"><span className="block text-xs font-black">{x}</span><span className="text-[11px] text-gray-400">{18-i*3}.4k posts</span></span>
              <ChevronRight size={16} className="text-gray-400"/>
            </Link>)}
          </div>
        </Card>
      </div>
    </div>
  </Page>;
}
type FriendPerson = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
};

type FriendRequestData = {
  id: string;
  sender: FriendPerson;
  receiver?: FriendPerson;
};

function Friends() {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState("requests");
  const [received, setReceived] = useState<FriendRequestData[]>([]);
  const [suggestions, setSuggestions] = useState<FriendPerson[]>([]);
  const [friends, setFriends] = useState<FriendPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const [requestResponse, friendResponse, userResponse] = await Promise.all([
          fetch("/api/friend-requests", { cache: "no-store" }),
          fetch("/api/friends", { cache: "no-store" }),
          fetch("/api/users?take=8", { cache: "no-store" }),
        ]);

        const requestJson = await requestResponse.json();
        const friendJson = await friendResponse.json();
        const userJson = await userResponse.json();

        if (!requestResponse.ok) throw new Error(requestJson.error ?? "Could not load friend requests.");
        if (!friendResponse.ok) throw new Error(friendJson.error ?? "Could not load friends.");
        if (!userResponse.ok) throw new Error(userJson.error ?? "Could not load suggestions.");

        if (!cancelled) {
          setReceived(requestJson.received ?? []);
          setFriends(friendJson.friends ?? []);
          setSuggestions((userJson.users ?? []).filter((user: { id: string }) => user.id !== session.user.id));
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load friends.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function respond(requestId: string, status: "ACCEPTED" | "DECLINED") {
    const response = await fetch("/api/friend-requests/" + requestId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      setReceived((items) => items.filter((item) => item.id !== requestId));
    }
  }

  async function sendRequest(userId: string) {
    const response = await fetch("/api/friend-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: userId }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not send friend request.");
      return;
    }

    setSuggestions((items) => items.filter((user) => user.id !== userId));
  }

  const initials = (name: string) => name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase();

  const requestCount = received.length;
  const displayPeople = tab === "requests" ? received.map((item) => item.sender) : tab === "suggestions" ? suggestions : friends;

  return <Page eyebrow="Friends" title="Manage your circle" subtitle="Review requests, discover people you know, and keep your connections organized.">
    {!session?.user ? (
      <div className="mb-5 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">Sign in to manage your real friendships.</div>
    ) : null}
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

    <div className="mb-5 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1.5">
      {[["requests","Requests",String(requestCount)],["suggestions","Suggestions",String(suggestions.length)],["all","All friends",String(friends.length)]].map((item)=>
        <button key={item[0]} onClick={()=>setTab(item[0])} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black ${tab===item[0] ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500"}`}>
          {item[1]} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px]">{item[2]}</span>
        </button>
      )}
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {loading && session?.user ? [1,2,3,4].map((item)=><Card key={item} className="flex items-center gap-4"><span className="size-14 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/2 animate-pulse rounded bg-gray-100"/></div></Card>) :
      displayPeople.map((person, i) => {
        const request = tab === "requests" ? received[i] : null;
        return <Card key={person.id} className="flex items-center gap-4">
          <Link href={"/profile/" + (person.username ?? person.id)}><Avatar initials={initials(person.name)} color={colors[i % colors.length]} size="lg"/></Link>
          <div className="min-w-0 flex-1">
            <Link href={"/profile/" + (person.username ?? person.id)} className="block truncate text-sm font-black hover:text-[#5a4be8]">{person.name}</Link>
            <p className="text-xs text-gray-400">@{person.username ?? "member"}</p>
            <p className="mt-2 truncate text-[11px] text-gray-400">{person.bio ?? "Socialhub member"}</p>
          </div>
          {tab === "requests" && request ? (
            <div className="flex gap-2">
              <button onClick={()=>void respond(request.id, "ACCEPTED")} className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white" aria-label="Accept request"><Check size={15}/></button>
              <button onClick={()=>void respond(request.id, "DECLINED")} className="grid size-9 place-items-center rounded-xl bg-gray-100 text-gray-600" aria-label="Decline request"><X size={15}/></button>
            </div>
          ) : tab === "suggestions" ? (
            <button onClick={()=>void sendRequest(person.id)} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white" aria-label="Send friend request"><UserPlus size={15}/></button>
          ) : null}
        </Card>;
      })}

      {!loading && displayPeople.length === 0 ? (
        <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Users size={20}/></span>
          <p className="mt-3 text-sm font-black">{tab === "requests" ? "No pending requests" : tab === "suggestions" ? "No new suggestions" : "No friends yet"}</p>
          <p className="mt-1 text-xs text-gray-400">Your next connection will appear here.</p>
        </div>
      ) : null}
    </div>
  </Page>;
}
type NotificationData = {
  id: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "MESSAGE" | "MENTION" | "SHARE" | "SYSTEM";
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string; username: string | null; image: string | null } | null;
  post?: { id: string; content: string | null; mediaUrl: string | null } | null;
  comment?: { id: string; content: string } | null;
};

function Notifications() {
  const { data: session } = authClient.useSession();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session?.user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load notifications.");
        if (!cancelled) setNotifications(json.notifications as NotificationData[]);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load notifications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function markAllRead() {
    if (!session?.user) return;
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (response.ok) setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() })));
  }

  function iconFor(type: NotificationData["type"]) {
    if (type === "LIKE") return Heart;
    if (type === "COMMENT" || type === "MESSAGE") return MessageCircle;
    if (type === "FOLLOW") return UserPlus;
    if (type === "FRIEND_REQUEST" || type === "FRIEND_ACCEPTED") return Users;
    if (type === "MENTION") return AtSign;
    if (type === "SHARE") return Send;
    return Bell;
  }

  function styleFor(type: NotificationData["type"]) {
    if (type === "LIKE") return "bg-rose-50 text-rose-500";
    if (type === "FOLLOW" || type === "FRIEND_ACCEPTED") return "bg-violet-50 text-violet-600";
    if (type === "COMMENT" || type === "MESSAGE" || type === "MENTION") return "bg-sky-50 text-sky-500";
    if (type === "FRIEND_REQUEST") return "bg-emerald-50 text-emerald-600";
    return "bg-amber-50 text-amber-500";
  }

  return <Page eyebrow="Notifications" title="Stay in the loop" subtitle="Important activity stays here so you can catch up without hunting through your feed.">
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 p-5"><h2 className="text-sm font-black">Recent activity</h2><button onClick={markAllRead} disabled={!session?.user} className="text-xs font-bold text-[#5a4be8] disabled:opacity-40">Mark all as read</button></div>
      {loading && session?.user ? <div className="space-y-2 p-5">{[1,2,3].map((i)=><div key={i} className="flex gap-3 p-3"><span className="size-10 animate-pulse rounded-2xl bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/3 animate-pulse rounded bg-gray-100"/></div></div>)}</div> : null}
      {notifications.length > 0 ? notifications.map((item) => {
        const Icon = iconFor(item.type);
        return <button key={item.id} className={`flex w-full gap-3 border-b border-gray-100 p-5 text-left last:border-0 hover:bg-gray-50 ${item.readAt ? "" : "bg-[#fbfaff]"}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${styleFor(item.type)}`}><Icon size={17}/></span>
          <span className="flex-1"><span className="block text-sm font-bold">{item.actor?.name ?? "Socialhub"} {item.type === "LIKE" ? "liked your post." : item.type === "FOLLOW" ? "started following you." : item.type === "COMMENT" ? "commented on your post." : item.type === "FRIEND_REQUEST" ? "sent you a friend request." : item.type === "FRIEND_ACCEPTED" ? "accepted your friend request." : item.type === "MESSAGE" ? "sent you a message." : item.type === "MENTION" ? "mentioned you." : "interacted with your content."}</span><span className="mt-1 block text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</span></span>{!item.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-[#6d5dfc]"/> : null}
        </button>;
      }) : !loading ? (
        session?.user ? <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Bell size={20}/></span><p className="mt-3 text-sm font-black">You’re all caught up.</p><p className="mt-1 text-xs text-gray-400">New likes, follows, comments, and requests will appear here.</p></div> :
        <div className="p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Bell size={20}/></span>
          <p className="mt-3 text-sm font-black">Sign in to see your notifications</p>
          <p className="mt-1 text-xs text-gray-400">Your real likes, follows, comments, messages, and requests will appear here.</p>
        </div>

