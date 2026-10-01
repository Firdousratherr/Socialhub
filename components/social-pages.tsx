"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AdminPanel } from "@/components/admin-panel";
import { MobileMenu } from "@/components/mobile-menu";
import {
  ArrowLeft, ArrowRight, AtSign, BarChart3, Bell, Bookmark, Camera, Check,
  ChevronRight, CircleHelp, Compass, Globe2, Heart, Image as ImageIcon,
  KeyRound, Lock, LogIn, Mail, MessageCircle, MoreHorizontal, Pencil, Plus,
  Paperclip, Search, Send, Settings, Shield, ShieldOff, Sparkles, Trash2, UserPlus, Users, X
} from "lucide-react";

type Screen = { kind: string; username?: string; section?: string; search?: string };

const colors = [
  "from-violet-500 to-sky-400",
  "from-fuchsia-500 to-orange-400",
  "from-emerald-400 to-cyan-500",
  "from-amber-400 to-rose-500",
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
  const [rememberMe, setRememberMe] = useState(false);
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
        : await authClient.signIn.email({ email: email.trim(), password, rememberMe, callbackURL: "/home" });
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
          <div className="grid grid-cols-3 gap-3">
  {[["Private by design","Respectful defaults"],["Real connections","No fake activity"],["Built to evolve","Features ship in milestones"]].map(([title,text]) => (
    <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-3">
      <p className="text-xs font-black">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-white/50">{text}</p>
    </div>
  ))}
</div>
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
                  {!signup && <div className="flex items-center justify-between text-xs font-semibold text-gray-500"><label className="flex items-center gap-2"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="accent-[#6d5dfc]"/>Remember me</label><button type="button" onClick={()=>{setError("");setNotice("");setStep("forgot");}} className="font-black text-[#5a4be8]">Forgot password?</button></div>}
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
  const [friendsHidden, setFriendsHidden] = useState(false);
  const [relationshipView, setRelationshipView] = useState<"followers" | "following" | "mutual" | null>(null);
  const [relationships, setRelationships] = useState<{
    followers: Array<{ id: string; name: string; username: string | null; image: string | null }>;
    following: Array<{ id: string; name: string; username: string | null; image: string | null }>;
    mutual: Array<{ id: string; name: string; username: string | null; image: string | null }>;
    hidden?: boolean;
  } | null>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username,
    bio: "",
    location: "",
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
    if (profileTab !== "friends" || !profile) return;
    let cancelled = false;
    void fetch(isOwner ? "/api/friends" : "/api/users/" + encodeURIComponent(profile.id) + "/friends", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load friends.");
        if (!cancelled) setFriends(json.friends ?? []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load friends.");
      });
    return () => { cancelled = true; };
  }, [isOwner, profileTab, profile?.id]);

  async function openRelationships(view: "followers" | "following" | "mutual") {
    if (!profile) return;
    setRelationshipView(view);
    if (relationships) return;
    setLoadingRelationships(true);
    try {
      const response = await fetch("/api/users/" + encodeURIComponent(profile.id) + "/relationships", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not load relationships.");
      setRelationships(json);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load relationships.");
      setRelationshipView(null);
    } finally {
      setLoadingRelationships(false);
    }
  }

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
  const postCount = profile?._count.posts ?? 0;
  const followerCount = profile?._count.followers ?? 0;
  const followingCount = profile?._count.following ?? 0;
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

  async function startMessage() {
    if (!profile || isOwner || !session?.user) return;
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: [profile.id], isGroup: false }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not start a conversation.");
      window.location.href = "/messages?conversation=" + encodeURIComponent(json.conversation.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start a conversation.");
    }
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
        <button onClick={() => void blockUser()} className="grid size-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600" aria-label="Block profile"><ShieldOff size={15}/></button>
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
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
  <span className="rounded-xl bg-gray-50 px-3 py-2"><strong className="font-black">{postCount}</strong> <span className="text-gray-400">posts</span></span>
  <button type="button" onClick={() => void openRelationships("followers")} className="rounded-xl bg-gray-50 px-3 py-2 hover:bg-[#eeebff]"><strong className="font-black">{followerCount}</strong> <span className="text-gray-400">followers</span></button>
  <button type="button" onClick={() => void openRelationships("following")} className="rounded-xl bg-gray-50 px-3 py-2 hover:bg-[#eeebff]"><strong className="font-black">{followingCount}</strong> <span className="text-gray-400">following</span></button>
  {!isOwner && session?.user && relationships?.mutual?.length ? <button type="button" onClick={() => void openRelationships("mutual")} className="rounded-xl bg-[#eeebff] px-3 py-2 font-bold text-[#5a4be8]">{relationships.mutual.length} mutual</button> : null}
</div>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {profile?.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-[#5a4be8] hover:bg-[#eeebff]">{profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : null}
          {profile?.isPrivate ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700">Private account</span> : null}
          <span className="rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-500">Joined {new Date(profile?.createdAt ?? Date.now()).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <button type="button" onClick={() => void shareProfile()} className="rounded-full bg-gray-950 px-3 py-1.5 text-[11px] font-black text-white">Share profile</button>
        </div>
        {relationshipView ? (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={relationshipView}>
            <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5"><div><h3 className="text-base font-black">{relationshipView === "followers" ? "Followers" : relationshipView === "following" ? "Following" : "Mutual friends"}</h3><p className="mt-1 text-[11px] text-gray-400">Real account relationships</p></div><button type="button" onClick={() => setRelationshipView(null)} className="grid size-9 place-items-center rounded-xl bg-gray-100" aria-label="Close"><X size={16}/></button></div>
              {loadingRelationships ? <div className="p-8 text-center text-xs text-gray-400">Loading…</div> : (
                <div className="max-h-[60vh] overflow-y-auto p-3">
                  {(() => {
                    const list = relationships?.[relationshipView] ?? [];
                    return list.length ? list.map((person) => <Link key={person.id} href={"/profile/" + encodeURIComponent(person.username ?? person.id)} onClick={() => setRelationshipView(null)} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-gray-50">
                      {person.image ? <img src={person.image} alt="" className="size-11 rounded-full object-cover"/> : <span className="grid size-11 place-items-center rounded-full bg-[#eeebff] text-xs font-black text-[#5a4be8]">{person.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span>}
                      <span className="min-w-0"><span className="block truncate text-sm font-black">{person.name}</span><span className="block truncate text-xs text-gray-400">@{person.username ?? "member"}</span></span>
                    </Link>) : <div className="p-8 text-center text-xs text-gray-400">No accounts to show.</div>;
                  })()}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-7 flex gap-6 border-b border-gray-100 pb-3 text-xs font-black">
          {(["posts","photos","friends"] as const).map((tab) => <button key={tab} type="button" onClick={() => setProfileTab(tab)} className={profileTab === tab ? "border-b-2 border-[#6d5dfc] pb-3 text-[#5a4be8]" : "pb-3 text-gray-400"}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
        </div>
        {profileTab === "friends" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {friendsHidden ? <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center"><Lock className="mx-auto text-gray-400" size={20}/><p className="mt-3 text-sm font-black">Friends are private</p><p className="mt-1 text-xs text-gray-400">Only the account owner and accepted friends can view this list.</p></div> : friends.length ? friends.map((friend) => <Link key={friend.id} href={"/profile/" + encodeURIComponent(friend.username ?? friend.id)} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white">
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
  attachments?: Array<{ id: string; url: string; kind: string }>;
  reactions?: Array<{ id: string; emoji: string; userId: string; user: { id: string; name: string; image: string | null } }>;
};

type ConversationData = {
  id: string;
  title: string | null;
  isGroup: boolean;
  unreadCount?: number;
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; name: string; username: string | null; image: string | null };
  }>;
  messages: Array<{ id: string; senderId: string; content: string; createdAt: string }>;
};

function Messages({ initialConversationId }: { initialConversationId?: string }) {
  const { data: session } = authClient.useSession();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextMessagesCursor, setNextMessagesCursor] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; name: string; username: string | null; image: string | null }>>([]);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentRef = useRef<HTMLInputElement | null>(null);

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
        setActiveId((current) => {
            if (initialConversationId && next.some((conversation) => conversation.id === initialConversationId)) return initialConversationId;
            return current && next.some((conversation) => conversation.id === current) ? current : next[0]?.id ?? null;
          });
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
  }, [session?.user?.id, initialConversationId]);

  useEffect(() => {
    if (!newConversationOpen || !session?.user) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch("/api/users?q=" + encodeURIComponent(userQuery) + "&take=8", { cache: "no-store" })
        .then(async (response) => {
          const json = await response.json().catch(() => ({}));
          if (response.ok && !cancelled) setPeople(json.users ?? []);
        })
        .catch(() => {});
    }, userQuery.trim() ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [newConversationOpen, userQuery, session?.user?.id]);

  async function startConversation(userId: string) {
    if (!session?.user) return;
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: [userId], isGroup: false }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not start conversation.");
      const conversation = json.conversation as ConversationData;
      setConversations((current) => current.some((item) => item.id === conversation.id) ? current : [conversation, ...current]);
      setActiveId(conversation.id);
      setNewConversationOpen(false);
      setUserQuery("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start conversation.");
    }
  }

  async function uploadAttachment(file: File | undefined) {
    if (!file || uploadingAttachment || pendingAttachments.length >= 4) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not upload attachment.");
      setPendingAttachments((current) => [...current, json.url].slice(0, 4));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not upload attachment.");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function reactToMessage(messageId: string, emoji = "❤️") {
    const existing = messages.find((message) => message.id === messageId)?.reactions?.find((reaction) => reaction.userId === session?.user?.id);
    const response = await fetch("/api/messages/" + messageId + "/reaction", {
      method: existing ? "DELETE" : "POST",
      headers: existing ? undefined : { "Content-Type": "application/json" },
      body: existing ? undefined : JSON.stringify({ emoji }),
    });
    if (response.ok) {
      const json = existing ? {} : await response.json().catch(() => ({}));
      setMessages((current) => current.map((message) => {
        if (message.id !== messageId) return message;
        const reactions = message.reactions ?? [];
        return { ...message, reactions: existing ? reactions.filter((reaction) => reaction.userId !== session?.user?.id) : [...reactions, json.reaction] };
      }));
    }
  }

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
        if (!cancelled) { setMessages(json.messages as ChatMessage[]); setNextMessagesCursor(json.nextBefore ?? null); }
        void fetch(`/api/conversations/${activeId}/messages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read" }),
        }).then(() => {
          if (!cancelled) setConversations((current) => current.map((conversation) =>
            conversation.id === activeId ? { ...conversation, unreadCount: 0 } : conversation
          ));
        }).catch(() => {});
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load messages.");
      }
    }

    void loadMessages();
    const timer = window.setInterval(() => { void loadMessages(); }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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

  async function loadOlderMessages() {
    if (!activeId || !nextMessagesCursor || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const response = await fetch(`/api/conversations/${activeId}/messages?before=${encodeURIComponent(nextMessagesCursor)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load older messages.");
      setMessages((current) => [...(json.messages as ChatMessage[]), ...current]);
      setNextMessagesCursor(json.nextBefore ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load older messages.");
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || (!draft.trim() && !pendingAttachments.length) || !session?.user || sending) return;

    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), attachments: pendingAttachments }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not send message.");
      setMessages((current) => [...current, json.message as ChatMessage]);
      setDraft("");
      setPendingAttachments([]);
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

    {newConversationOpen ? <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4"><div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-gray-100 p-5"><div><h2 className="text-base font-black">New message</h2><p className="mt-1 text-xs text-gray-400">Choose a real Socialhub account to start a chat.</p></div><button type="button" onClick={() => setNewConversationOpen(false)} className="grid size-9 place-items-center rounded-xl bg-gray-100"><X size={16}/></button></div><div className="p-4"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/><input autoFocus value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search people…" className="h-10 w-full rounded-xl bg-gray-50 pl-9 pr-3 text-xs font-semibold outline-none"/></label><div className="mt-3 space-y-1">{people.length ? people.map((person)=><button type="button" key={person.id} onClick={() => void startConversation(person.id)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-gray-50"><Avatar initials={person.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()}/><span className="min-w-0"><span className="block truncate text-xs font-black">{person.name}</span><span className="block truncate text-[10px] text-gray-400">@{person.username ?? "member"}</span></span></button>) : <p className="p-6 text-center text-xs text-gray-400">{userQuery.trim() ? "No people found." : "Search for someone to message."}</p>}</div></div></div></div> : null}

    <div className="grid min-h-[620px] overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)] lg:grid-cols-[330px_1fr]">
      <aside className="border-b border-gray-100 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-gray-100 p-4"><h2 className="text-sm font-black">Inbox</h2><button type="button" onClick={() => setNewConversationOpen(true)} className="social-icon-button" aria-label="Start a new message"><Pencil size={17}/></button></div>
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
              {conversation.unreadCount ? <span className="min-w-5 rounded-full bg-[#6d5dfc] px-1.5 py-1 text-center text-[9px] font-black text-white">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span> : null}
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
          <button type="button" onClick={() => setMessageSearch("")} className="social-icon-button" aria-label="Clear message search"><Search size={17}/></button><button type="button" onClick={() => setError(active ? "Conversation options will be available here as messaging settings ship." : "Select a conversation first.")} className="social-icon-button" aria-label="Conversation options"><MoreHorizontal size={18}/></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {nextMessagesCursor ? <div className="flex justify-center"><button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[10px] font-black text-gray-600 shadow-sm disabled:opacity-50">{loadingOlderMessages ? "Loading older messages…" : "Load older messages"}</button></div> : null}
          {active && messages.length > 0 ? messages.map((message) => {
            const mine = message.senderId === session?.user?.id;
            return <div key={message.id} className={mine ? "flex justify-end" : "flex items-end gap-2"}>
              {!mine ? <Avatar initials={message.sender.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} size="sm"/> : null}
              <div className="max-w-[76%]">
                <div className={mine ? "rounded-2xl rounded-br-md bg-[#6d5dfc] px-4 py-3 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700"}>
                  {message.attachments?.length ? <div className="mb-2 grid gap-2">{message.attachments.map((attachment)=><img key={attachment.id} src={attachment.url} alt="Message attachment" className="max-h-72 w-full rounded-xl object-cover"/>)}</div> : null}
                  {message.content ? <span>{message.content}</span> : null}
                </div>
                <div className={"mt-1 flex items-center gap-2 " + (mine ? "justify-end" : "")}>
                  {message.reactions?.length ? <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px]">{message.reactions.map((reaction)=>reaction.emoji).join("")}</span> : null}
                  <button type="button" onClick={() => void reactToMessage(message.id)} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-50" aria-label="React with heart">❤️</button>
                </div>
              </div>
            </div>;
          }) : (
            <div className="flex h-full min-h-56 items-center justify-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><MessageCircle size={20}/></span><p className="mt-3 text-sm font-black">{active ? "No messages yet" : "Pick a conversation"}</p><p className="mt-1 text-xs text-gray-400">{active ? "Send the first message below." : "Choose a chat from your inbox to start."}</p></div></div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t border-gray-100 p-3">
          <input ref={attachmentRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => { void uploadAttachment(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          {pendingAttachments.length ? <div className="mb-2 flex gap-2 overflow-x-auto">{pendingAttachments.map((url, index)=><div key={url} className="relative shrink-0"><img src={url} alt="Pending attachment" className="size-16 rounded-xl object-cover"/><button type="button" onClick={() => setPendingAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-gray-950 text-white"><X size={11}/></button></div>)}</div> : null}
          <div className="flex items-end gap-2 rounded-2xl bg-gray-50 p-2"><button type="button" onClick={() => attachmentRef.current?.click()} disabled={!active || uploadingAttachment || pendingAttachments.length >= 4} className="grid size-10 place-items-center rounded-xl bg-white text-gray-500 disabled:opacity-40" aria-label="Attach image"><Paperclip size={16}/></button><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={1} disabled={!active || !session?.user || sending} className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder={active ? "Write a message…" : "Select a conversation first"}/><button type="submit" disabled={!active || (!draft.trim() && !pendingAttachments.length) || !session?.user || sending} className="grid size-10 place-items-center rounded-xl bg-gray-950 text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={16}/></button></div>
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
  isFollowing?: boolean;
  isFriend?: boolean;
  _count: { followers: number; following: number };
};

function Discover({ initialQuery = "" }: { initialQuery?: string }) {
  const { data: session } = authClient.useSession();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<Array<{ id: string; content: string | null; createdAt: string; author: { id: string; name: string; username: string | null; image: string | null }; _count: { likes: number; comments: number } }>>([]);
  const [discoverHashtags, setDiscoverHashtags] = useState<Array<{ tag: string; count: number }>>([]);
  const [discoverTab, setDiscoverTab] = useState<"people" | "posts" | "hashtags">("people");
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [trends, setTrends] = useState<Array<{ tag: string; posts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/discover/trends", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (response.ok && !cancelled) setTrends(json.trends ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/search?q=" + encodeURIComponent(q) + "&take=20", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not search.");
        if (!cancelled) {
          const nextResults = (json.users ?? []) as DiscoverUser[];
          setResults(nextResults);
          setDiscoverPosts(json.posts ?? []);
          setDiscoverHashtags(json.hashtags ?? []);
          setFollowing(new Set(nextResults.filter((user) => user.isFollowing).map((user) => user.id)));
        }
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
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {([["people","People"],["posts","Posts"],["hashtags","Hashtags"]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setDiscoverTab(value)} className={"rounded-xl px-3.5 py-2 text-xs font-black " + (discoverTab === value ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-50 text-gray-400")}>{label}</button>)}
          </div>
          <span className="text-[11px] font-semibold text-gray-400">Results come from real Socialhub data.</span>
        </div>
      </Card>

      {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

      <div className="grid gap-5 md:grid-cols-2">
        {discoverTab === "people" ? <Card>
          <div className="flex justify-between"><h2 className="text-sm font-black">{q ? "People results" : "Suggested people"}</h2><span className="text-xs font-bold text-gray-400">{results.length} people</span></div>
          <div className="mt-4 space-y-4">{loading ? [1,2,3].map((item)=><div key={item} className="flex items-center gap-3 p-2"><span className="size-10 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/2 animate-pulse rounded bg-gray-100"/></div></div>) :
          results.map((user, i) => {
            const initials = user.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase();
            const isFollowing = following.has(user.id);
            return <div key={user.id} className="flex items-center gap-3">
              <Link href={"/profile/" + (user.username ?? user.id)}><Avatar initials={initials} color={colors[i % colors.length]}/></Link>
              <div className="min-w-0 flex-1"><Link href={"/profile/" + (user.username ?? user.id)} className="block truncate text-xs font-black hover:text-[#5a4be8]">{user.name}</Link><p className="truncate text-[11px] text-gray-400">@{user.username ?? "member"} · {user._count.followers} followers</p></div>
              <button onClick={()=>void toggleFollow(user)} className={isFollowing ? "grid size-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600" : "grid size-9 place-items-center rounded-xl bg-gray-950 text-white"} aria-label={isFollowing ? "Unfollow" : "Follow"}>{isFollowing ? <Check size={15}/> : <UserPlus size={15}/>}</button>
            </div>;
          })}</div>
        </Card> : discoverTab === "posts" ? <Card>
          <div className="flex justify-between"><h2 className="text-sm font-black">Post results</h2><span className="text-xs font-bold text-gray-400">{discoverPosts.length} posts</span></div>
          <div className="mt-4 space-y-3">{discoverPosts.length ? discoverPosts.map((post) => <Link key={post.id} href={"/home#post-" + encodeURIComponent(post.id)} className="block rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white"><div className="flex items-center gap-3"><Avatar initials={post.author.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()}/><div><p className="text-xs font-black">{post.author.name}</p><p className="text-[10px] text-gray-400">@{post.author.username ?? "member"} · {new Date(post.createdAt).toLocaleString()}</p></div></div><p className="mt-3 text-sm leading-6 text-gray-600">{post.content ?? "Media post"}</p><p className="mt-2 text-[10px] text-gray-400">{post._count.likes} likes · {post._count.comments} comments</p></Link>) : <p className="py-8 text-center text-xs text-gray-400">No matching posts found.</p>}</div>
        </Card> : <Card>
          <div className="flex justify-between"><h2 className="text-sm font-black">Hashtags</h2><span className="text-xs font-bold text-gray-400">{discoverHashtags.length} tags</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{discoverHashtags.length ? discoverHashtags.map((item) => <Link key={item.tag} href={"/discover?q=" + encodeURIComponent(item.tag)} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white"><span className="block text-sm font-black text-[#5a4be8]">{item.tag}</span><span className="mt-1 block text-[10px] text-gray-400">{item.count} matching posts in the current result set</span></Link>) : <p className="py-8 text-center text-xs text-gray-400">No matching hashtags found.</p>}</div>
        </Card>}

        <Card>
          <h2 className="text-sm font-black">Trending hashtags</h2>
          <div className="mt-4 space-y-2">
            {trends.length ? trends.map((trend, i) => <Link key={trend.tag} href={"/discover?q=" + encodeURIComponent(trend.tag)} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-gray-50">
              <span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-[10px] font-black text-gray-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1"><span className="block text-xs font-black">{trend.tag}</span><span className="text-[11px] text-gray-400">{trend.posts} {trend.posts === 1 ? "post" : "posts"}</span></span>
              <ChevronRight size={16} className="text-gray-400"/>
            </Link>) : <p className="py-4 text-xs text-gray-400">No hashtags are trending yet. Start a conversation with a hashtag.</p>}
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
  const [sent, setSent] = useState<FriendRequestData[]>([]);
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
          setSent(requestJson.sent ?? []);
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

  async function cancelRequest(requestId: string) {
    const response = await fetch("/api/friend-requests/" + requestId, { method: "DELETE" });
    if (response.ok) setSent((items) => items.filter((item) => item.id !== requestId));
    else {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not cancel friend request.");
    }
  }

  async function removeFriend(friendId: string) {
    if (!window.confirm("Remove this friend?")) return;
    const response = await fetch("/api/friends/" + friendId, { method: "DELETE" });
    if (response.ok) setFriends((items) => items.filter((item) => item.id !== friendId));
    else {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not remove friend.");
    }
  }

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
  const displayPeople = tab === "requests" ? received.map((item) => item.sender) : tab === "sent" ? sent.map((item) => item.receiver!).filter(Boolean) : tab === "suggestions" ? suggestions : friends;

  return <Page eyebrow="Friends" title="Manage your circle" subtitle="Review requests, discover people you know, and keep your connections organized.">
    {!session?.user ? (
      <div className="mb-5 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">Sign in to manage your real friendships.</div>
    ) : null}
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

    <div className="mb-5 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1.5">
      {[["requests","Requests",String(requestCount)],["sent","Sent",String(sent.length)],["suggestions","Suggestions",String(suggestions.length)],["all","All friends",String(friends.length)]].map((item)=>
        <button key={item[0]} onClick={()=>setTab(item[0])} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black ${tab===item[0] ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500"}`}>
          {item[1]} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px]">{item[2]}</span>
        </button>
      )}
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {loading && session?.user ? [1,2,3,4].map((item)=><Card key={item} className="flex items-center gap-4"><span className="size-14 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/2 animate-pulse rounded bg-gray-100"/></div></Card>) :
      displayPeople.map((person, i) => {
        const request = tab === "requests" ? received[i] : tab === "sent" ? sent[i] : null;
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
          ) : tab === "sent" && request ? (
            <button onClick={()=>void cancelRequest(request.id)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black text-gray-600" aria-label="Cancel friend request">Cancel</button>
          ) : tab === "suggestions" ? (
            <button onClick={()=>void sendRequest(person.id)} className="grid size-9 place-items-center rounded-xl bg-gray-950 text-white" aria-label="Send friend request"><UserPlus size={15}/></button>
          ) : tab === "all" ? (
            <button onClick={()=>void removeFriend(person.id)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black text-red-600 hover:bg-red-50" aria-label={"Remove " + person.name}>Remove</button>
          ) : null}
        </Card>;
      })}

      {!loading && displayPeople.length === 0 ? (
        <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Users size={20}/></span>
          <p className="mt-3 text-sm font-black">{tab === "requests" ? "No pending requests" : tab === "sent" ? "No sent requests" : tab === "suggestions" ? "No new suggestions" : "No friends yet"}</p>
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
  message?: { id: string; conversationId: string } | null;
};

function Notifications() {
  const { data: session } = authClient.useSession();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [nextNotificationCursor, setNextNotificationCursor] = useState<string | null>(null);
  const [loadingOlderNotifications, setLoadingOlderNotifications] = useState(false);
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
        if (!cancelled) { setNotifications(json.notifications as NotificationData[]); setNextNotificationCursor(json.nextBefore ?? null); }
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

  async function loadOlderNotifications() {
    if (!nextNotificationCursor || loadingOlderNotifications) return;
    setLoadingOlderNotifications(true);
    try {
      const response = await fetch("/api/notifications?before=" + encodeURIComponent(nextNotificationCursor), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load older notifications.");
      setNotifications((current) => [...current, ...(json.notifications as NotificationData[])]);
      setNextNotificationCursor(json.nextBefore ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load older notifications.");
    } finally {
      setLoadingOlderNotifications(false);
    }
  }

  async function markAllRead() {
    if (!session?.user) return;
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (response.ok) setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() })));
  }

  async function openNotification(item: NotificationData) {
    if (!session?.user) return;
    if (!item.readAt) {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      });
      if (response.ok) setNotifications((items) => items.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row));
    }

    if (item.type === "FOLLOW" && item.actor?.username) {
      window.location.href = "/profile/" + encodeURIComponent(item.actor.username);
    } else if (item.type === "FRIEND_REQUEST" || item.type === "FRIEND_ACCEPTED") {
      window.location.href = "/friends";
    } else if (item.type === "MESSAGE" && item.message?.conversationId) {
      window.location.href = "/messages?conversation=" + encodeURIComponent(item.message.conversationId);
    } else if (item.post?.id) {
      window.location.href = "/home#post-" + encodeURIComponent(item.post.id);
    } else {
      window.location.href = "/home";
    }
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
      {notifications.length > 0 ? <>
        {notifications.map((item) => {
        const Icon = iconFor(item.type);
        return <button key={item.id} onClick={() => void openNotification(item)} className={`flex w-full gap-3 border-b border-gray-100 p-5 text-left last:border-0 hover:bg-gray-50 ${item.readAt ? "" : "bg-[#fbfaff]"}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${styleFor(item.type)}`}><Icon size={17}/></span>
          <span className="flex-1"><span className="block text-sm font-bold">{item.actor?.name ?? "Socialhub"} {item.type === "LIKE" ? "liked your post." : item.type === "FOLLOW" ? "started following you." : item.type === "COMMENT" ? "commented on your post." : item.type === "FRIEND_REQUEST" ? "sent you a friend request." : item.type === "FRIEND_ACCEPTED" ? "accepted your friend request." : item.type === "MESSAGE" ? "sent you a message." : item.type === "MENTION" ? "mentioned you." : "interacted with your content."}</span><span className="mt-1 block text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</span></span>
          {!item.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-[#6d5dfc]"/> : null}
        </button>;
        })}
        {nextNotificationCursor ? <div className="border-t border-gray-100 p-4 text-center"><button type="button" onClick={() => void loadOlderNotifications()} disabled={loadingOlderNotifications} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[10px] font-black text-gray-600 disabled:opacity-50">{loadingOlderNotifications ? "Loading older notifications…" : "Load older notifications"}</button></div> : null}
      </> : !loading ? (
        session?.user ? (
          <div className="p-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Bell size={20}/></span>
            <p className="mt-3 text-sm font-black">You’re all caught up.</p>
            <p className="mt-1 text-xs text-gray-400">New likes, follows, comments, and requests will appear here.</p>
          </div>
        ) : (
          <div className="p-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Bell size={20}/></span>
            <p className="mt-3 text-sm font-black">Sign in to see your notifications</p>
            <p className="mt-1 text-xs text-gray-400">Your real likes, follows, comments, messages, and requests will appear here.</p>
          </div>
        )
      ) : null}

    </Card>
  </Page>;
}

function SettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [privateAccount, setPrivate] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({ showFriendsList: true, allowMessagesEveryone: true, allowFriendRequests: true });
  const [savingPrivacySetting, setSavingPrivacySetting] = useState<string | null>(null);
  const [email, setEmail] = useState("Not loaded");
  const [username, setUsername] = useState("Not loaded");
  const [loading, setLoading] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [savingPreference, setSavingPreference] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; createdAt: string; updatedAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null; isCurrent: boolean }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load account.");
        if (!cancelled) {
          setPrivate(Boolean(json.profile.isPrivate));
          setEmail(json.profile.email);
          setUsername(json.profile.username ? "@" + json.profile.username : "No username");
        }
      } catch (requestError) {
        if (!cancelled) setMessage(requestError instanceof Error ? requestError.message : "Could not load account.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/notification-preferences", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load notification preferences.");
        setPreferences(json.preferences ?? {});
      })
      .catch((requestError) => setMessage(requestError instanceof Error ? requestError.message : "Could not load notification preferences."));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/privacy-settings", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load privacy settings.");
        setPrivacySettings(json.settings ?? privacySettings);
      })
      .catch((requestError) => setMessage(requestError instanceof Error ? requestError.message : "Could not load privacy settings."));
  }, [session?.user?.id]);

  async function updatePrivacySetting(key: "showFriendsList" | "allowMessagesEveryone" | "allowFriendRequests", value: boolean) {
    if (!session?.user || savingPrivacySetting) return;
    setSavingPrivacySetting(key);
    try {
      const response = await fetch("/api/privacy-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not save privacy setting.");
      setPrivacySettings(json.settings ?? privacySettings);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Could not save privacy setting.");
    } finally {
      setSavingPrivacySetting(null);
    }
  }

  async function updatePreference(key: string, value: boolean) {
    if (!session?.user || savingPreference) return;
    setSavingPreference(key);
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not save notification preference.");
      setPreferences(json.preferences ?? {});
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Could not save notification preference.");
    } finally {
      setSavingPreference(null);
    }
  }

  useEffect(() => {
    if (!session?.user) return;
    setLoadingSessions(true);
    void fetch("/api/security/sessions", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load active sessions.");
        setSessions(json.sessions ?? []);
      })
      .catch((requestError) => setMessage(requestError instanceof Error ? requestError.message : "Could not load active sessions."))
      .finally(() => setLoadingSessions(false));
  }, [session?.user?.id]);

  async function revokeSession(sessionId?: string) {
    if (!session?.user) return;
    const allOther = !sessionId;
    if (allOther && !window.confirm("Sign out all other devices?")) return;
    try {
      const response = await fetch("/api/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allOther ? { allOther: true } : { sessionId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not revoke session.");
      setSessions((current) => allOther ? current.filter((item) => item.isCurrent) : current.filter((item) => item.id !== sessionId));
      setMessage(allOther ? `Signed out of ${json.revoked ?? 0} other session(s).` : "Session revoked.");
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Could not revoke session.");
    }
  }

  async function updatePrivacy(value: boolean) {
    if (!session?.user || savingPrivacy) return;

    setSavingPrivacy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: value }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update privacy.");
      setPrivate(Boolean(json.profile.isPrivate));
      setMessage("Privacy setting saved.");
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Could not update privacy.");
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (!session?.user) return;
    const confirmed = window.confirm("Delete your Socialhub account permanently? This cannot be undone.");
    if (!confirmed) return;

    const response = await fetch("/api/profile", { method: "DELETE" });
    if (response.ok) {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } else {
      const json = await response.json().catch(() => ({}));
      setMessage(json.error ?? "Could not delete account.");
    }
  }

  const Toggle = ({ value, disabled, onChange }: { value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={"relative h-7 w-12 rounded-full p-1 transition " + (value ? "bg-[#6d5dfc]" : "bg-gray-200") + (disabled ? " cursor-not-allowed opacity-50" : "")}
      aria-pressed={value}
    >
      <span className={"block size-5 rounded-full bg-white transition-transform " + (value ? "translate-x-5" : "")}/>
    </button>
  );

  return <Page eyebrow="Settings" title="Make Socialhub yours" subtitle="Control account, privacy, notifications, and security from one place.">
    {!session?.user ? (
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">
        <span>Sign in to save account settings.</span>
        <Link href="/login" className="font-black underline">Sign in</Link>
      </div>
    ) : null}
    {message ? <div role="status" className="mb-5 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-semibold text-gray-600">{message}</div> : null}

    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit !p-4">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-gray-400">Settings areas</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-gray-500">
          {["General","Privacy","Notifications","Security","Help"].map((label) => <span key={label} className="rounded-xl bg-gray-50 px-3 py-2">{label}</span>)}
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black">Account</h2>
            {loading ? <span className="text-[10px] font-bold text-gray-400">Loading…</span> : null}
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Email address", email, Mail],
              ["Username", username, AtSign],
              ["Password", "Managed by your sign-in method", KeyRound],
            ].map(([title, detail, Icon]) =>
              <button key={String(title)} type="button" className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 p-3 text-left hover:bg-gray-50">
                <span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-gray-500"><Icon size={16}/></span>
                <span className="flex-1"><span className="block text-xs font-black">{String(title)}</span><span className="text-[11px] text-gray-400">{String(detail)}</span></span>
                <ChevronRight size={16} className="text-gray-400"/>
              </button>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-black">Privacy & presence</h2>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Private account</p><p className="text-xs text-gray-400">Only approved followers can see your posts.</p></div>
              <Toggle value={privateAccount} disabled={!session?.user || savingPrivacy} onChange={(value)=>void updatePrivacy(value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Show friends and relationship lists</p><p className="text-xs text-gray-400">Let other people open your Friends, Followers and Following lists.</p></div>
              <Toggle value={privacySettings.showFriendsList} disabled={!session?.user || savingPrivacySetting === "showFriendsList"} onChange={(value)=>void updatePrivacySetting("showFriendsList", value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Allow messages from everyone</p><p className="text-xs text-gray-400">Turn off to limit new direct conversations to accepted friends.</p></div>
              <Toggle value={privacySettings.allowMessagesEveryone} disabled={!session?.user || savingPrivacySetting === "allowMessagesEveryone"} onChange={(value)=>void updatePrivacySetting("allowMessagesEveryone", value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Allow friend requests</p><p className="text-xs text-gray-400">Turn off to stop new people from sending friend requests.</p></div>
              <Toggle value={privacySettings.allowFriendRequests} disabled={!session?.user || savingPrivacySetting === "allowFriendRequests"} onChange={(value)=>void updatePrivacySetting("allowFriendRequests", value)}/>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-black">Notifications</h2>
          <p className="mt-2 text-xs leading-5 text-gray-400">Choose which activity appears in your notification inbox.</p>
          <div className="mt-4 divide-y divide-gray-100"><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Likes</p><p className="mt-0.5 text-[11px] text-gray-400">When someone likes your posts.</p></div><Toggle value={Boolean(preferences.likes)} disabled={!session?.user || savingPreference === "likes"} onChange={(value)=>void updatePreference("likes", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Comments</p><p className="mt-0.5 text-[11px] text-gray-400">When someone comments on your posts.</p></div><Toggle value={Boolean(preferences.comments)} disabled={!session?.user || savingPreference === "comments"} onChange={(value)=>void updatePreference("comments", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Follows</p><p className="mt-0.5 text-[11px] text-gray-400">When someone follows you.</p></div><Toggle value={Boolean(preferences.follows)} disabled={!session?.user || savingPreference === "follows"} onChange={(value)=>void updatePreference("follows", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Friend requests</p><p className="mt-0.5 text-[11px] text-gray-400">When someone sends you a friend request.</p></div><Toggle value={Boolean(preferences.friendRequests)} disabled={!session?.user || savingPreference === "friendRequests"} onChange={(value)=>void updatePreference("friendRequests", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Friend requests accepted</p><p className="mt-0.5 text-[11px] text-gray-400">When a friend request is accepted.</p></div><Toggle value={Boolean(preferences.friendAccepted)} disabled={!session?.user || savingPreference === "friendAccepted"} onChange={(value)=>void updatePreference("friendAccepted", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Messages</p><p className="mt-0.5 text-[11px] text-gray-400">When you receive a new message notification.</p></div><Toggle value={Boolean(preferences.messages)} disabled={!session?.user || savingPreference === "messages"} onChange={(value)=>void updatePreference("messages", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Mentions</p><p className="mt-0.5 text-[11px] text-gray-400">When someone mentions you.</p></div><Toggle value={Boolean(preferences.mentions)} disabled={!session?.user || savingPreference === "mentions"} onChange={(value)=>void updatePreference("mentions", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Shares</p><p className="mt-0.5 text-[11px] text-gray-400">When your content is shared.</p></div><Toggle value={Boolean(preferences.shares)} disabled={!session?.user || savingPreference === "shares"} onChange={(value)=>void updatePreference("shares", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">System</p><p className="mt-0.5 text-[11px] text-gray-400">Important account and platform notices.</p></div><Toggle value={Boolean(preferences.system)} disabled={!session?.user || savingPreference === "system"} onChange={(value)=>void updatePreference("system", value)}/></div></div>
        </Card>

        {session?.user ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-black">Active sessions</h2><p className="mt-1 text-xs text-gray-400">Review devices signed in to your account.</p></div>
              <button type="button" onClick={() => void revokeSession()} disabled={sessions.length <= 1} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Sign out other devices</button>
            </div>
            <div className="mt-4 space-y-2">
              {loadingSessions ? <div className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-400">Loading sessions…</div> :
               sessions.length ? sessions.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                  <span className={"grid size-9 place-items-center rounded-xl " + (item.isCurrent ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-100 text-gray-500")}><Shield size={16}/></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{item.isCurrent ? "Current device" : item.userAgent?.slice(0, 70) || "Other session"}</span><span className="block mt-0.5 text-[10px] text-gray-400">{item.ipAddress ? item.ipAddress + " · " : ""}{new Date(item.updatedAt).toLocaleString()}</span></span>
                  {!item.isCurrent ? <button type="button" onClick={() => void revokeSession(item.id)} className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[10px] font-black text-gray-600 hover:bg-gray-50">Revoke</button> : null}
                </div>
              )) : <div className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-400">No active sessions were found.</div>}
            </div>
            <button onClick={()=>void signOut()} className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50">Sign out current device</button>
          </Card>
        ) : null}

        <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-red-600"><Trash2 size={17}/><h2 className="text-sm font-black">Danger zone</h2></div>
          <p className="mt-2 text-xs leading-5 text-red-500/75">Deleting your account permanently removes your profile, posts, messages, and social activity.</p>
          <button onClick={()=>void deleteAccount()} disabled={!session?.user} className="mt-4 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-xs font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50">Delete account</button>
        </div>
      </div>
    </div>
  </Page>;
}
function Admin({ section="overview" }: { section?: string }) {
  return <AdminPanel section={section}/>;
}
export function SocialPages({ screen }: { screen: Screen }) {
  if (screen.kind==="login") return <Auth/>;
  if (screen.kind==="signup") return <Auth signup/>;
  if (screen.kind==="profile") return <Profile username={screen.username}/>;
  if (screen.kind==="messages") return <Messages initialConversationId={screen.search}/>;
  if (screen.kind==="discover") return <Discover/>;
  if (screen.kind==="friends") return <Friends/>;
  if (screen.kind==="notifications") return <Notifications/>;
  if (screen.kind==="settings") return <SettingsPage/>;
  if (screen.kind==="admin") return <Admin section={screen.section}/>;
  return <Page eyebrow="Socialhub" title="You're all caught up." subtitle="Use the main navigation to keep exploring the experience."><Card><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Sparkles size={20}/></span><div><h2 className="font-black">This route is ready.</h2><p className="mt-2 text-sm text-gray-500">The screen shell is in place so real data can be connected without redesigning the interface.</p></div></div></Card></Page>;
}
