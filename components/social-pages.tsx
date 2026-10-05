"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { createPortal } from "react-dom";
import { AdminWorkspace } from "@/components/admin-workspace";
import { AccountBadge } from "@/components/account-badge";
import { emitPostSyncEvent } from "@/lib/post-sync";
import { compactCount, fullCount } from "@/lib/compact-count";
import { formatJoinedDate, formatSocialDate, formatSocialDateTime } from "@/lib/social-date";
import { PostContent } from "@/components/post-content";
import { emitLiveSync, subscribeLiveSync } from "@/lib/live-sync";
import { emitUnreadSummarySync } from "@/hooks/use-unread-summary";
import { useLivePoll } from "@/hooks/use-live-poll";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/social-ui";
import {
  ArrowLeft, ArrowRight, AtSign, BarChart3, Bell, Bookmark, Camera, Check,
  ChevronRight, CircleHelp, Compass, Globe2, Heart, Image as ImageIcon,
  KeyRound, Lock, LogIn, Mail, MessageCircle, MoreHorizontal, Pencil, Plus,
  Paperclip, Search, Send, Settings, Shield, ShieldOff, Share2, Sparkles, Trash2, UserPlus, Users, X
} from "lucide-react";

type Screen = { kind: string; username?: string; section?: string; search?: string };

const colors = [
  "from-violet-500 to-sky-400",
  "from-fuchsia-500 to-orange-400",
  "from-emerald-400 to-cyan-500",
  "from-amber-400 to-rose-500",
];

function Avatar({ initials, color = colors[0], size = "md", image }: { initials: string; color?: string; size?: "sm"|"md"|"lg"|"xl"; image?: string | null }) {
  const sizes = { sm: "size-8 text-xs", md: "size-10 text-xs", lg: "size-14 text-sm", xl: "size-24 text-2xl" };
  return image ? (
    <img src={image} alt="" className={`shrink-0 rounded-full object-cover shadow-sm ${sizes[size].split(" ").filter(Boolean)[0]}`} />
  ) : (
    <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${color} ${sizes[size]} font-black text-white shadow-sm`}>{initials}</div>
  );
}

function Page({
  eyebrow,
  title,
  subtitle,
  action,
  fallbackHref = "/home",
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  fallbackHref?: string;
  children: React.ReactNode;
  wide?: boolean;
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
    <main className="min-h-screen pb-24 md:pb-8">
      <div className={"mx-auto w-full px-3 py-3 sm:px-4 sm:py-5 lg:px-0 " + (wide ? "max-w-[980px]" : "max-w-[760px]")}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button type="button" onClick={goBack} className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50" aria-label="Go back">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              {eyebrow ? <p className="hidden text-xs font-black uppercase tracking-[0.16em] text-[#6d5dfc] sm:block">{eyebrow}</p> : null}
              <h1 className="page-heading mt-0">{title}</h1>
              {subtitle ? <p className="page-description mt-1 hidden max-w-2xl sm:block">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`social-card rounded-3xl p-5 ${className}`}>{children}</section>;
}
function SettingsToggle({ value, disabled, onChange }: { value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
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
  const [usernameAvailability, setUsernameAvailability] = useState<"checking" | "available" | "taken" | "">("");

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!signup) return;
    const candidate = email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._]/g, "").replace(/^[._]+|[._]+$/g, "").slice(0, 24);
    if (candidate.length < 3 || !email.includes("@")) {
      setUsernameAvailability("");
      return;
    }
    let cancelled = false;
    setUsernameAvailability("checking");
    const timer = window.setTimeout(() => {
      void fetch("/api/users?q=" + encodeURIComponent(candidate) + "&take=20", { cache: "no-store" })
        .then(async (response) => {
          const json = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error("Could not check username.");
          const exists = (json.users ?? []).some((user: { username?: string | null }) => user.username?.toLowerCase() === candidate);
          if (!cancelled) setUsernameAvailability(exists ? "taken" : "available");
        })
        .catch(() => {
          if (!cancelled) setUsernameAvailability("");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email, signup]);

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

  async function requestPasswordResetCode() {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Could not start password recovery.");
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await requestPasswordResetCode();
      setStep("forgot-verify"); setOtp(""); setCooldown(30);
      setNotice("Check your email for a 6-digit password reset code.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start password recovery.");
    } finally { setLoading(false); }
  }

  async function resendPasswordReset() {
    if (cooldown || loading) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await requestPasswordResetCode();
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

  async function continueWithGoogle() {
    if (loading) return;
    setError(""); setNotice(""); setLoading(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/home" });
      if (result.error) {
        setError(result.error.message || "Google sign-in failed. Check that Google login is configured.");
        setLoading(false);
      }
    } catch {
      setError("We could not start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  function resetAuthView() {
    setStep("form"); setError(""); setNotice(""); setOtp(""); setNewPassword(""); setCooldown(0);
  }

  const title = step === "verify-signup" ? "Verify your email."
    : step === "forgot" ? "Recover your account."
    : step === "forgot-verify" ? "Create a new password."
    : signup ? "Create your Socialhub account." : "Welcome back to Socialhub.";
  const subtitle = step === "verify-signup" ? "Enter the code we sent to " + email + "."
    : step === "forgot" ? "We’ll send a secure 6-digit code to your email."
    : step === "forgot-verify" ? "Enter the code from your email and choose a new password."
    : signup ? "Build your profile, find your people, and make Socialhub yours." : "Sign in to continue to your feed and conversations.";

  const formShell = (
    <>
      <div className="mb-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d5dfc]">
          {step === "verify-signup" ? "Email verification" : step.startsWith("forgot") ? "Account recovery" : signup ? "Create account" : "Secure sign in"}
        </p>
        <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-[-0.045em] text-gray-950 sm:text-[2.25rem]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">{subtitle}</p>
      </div>

      {step === "verify-signup" ? (
        <form onSubmit={verifySignupOtp} className="space-y-4">
          <div className="rounded-3xl border border-[#ddd8ff] bg-gradient-to-br from-[#f7f5ff] to-[#f2faff] p-5 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Mail size={20}/></div>
            <p className="mt-3 text-sm font-black text-gray-900">Check your inbox</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">The code is valid for 10 minutes and has a limited number of attempts.</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-gray-600">6-digit code</span>
            <input value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-center text-2xl font-black tracking-[.45em] outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="000000"/>
          </label>
          {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
          {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">{notice}</div> : null}
          <button type="submit" disabled={loading || otp.length !== 6} className="h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white shadow-lg shadow-gray-950/10 transition hover:-translate-y-0.5 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Verifying…" : "Verify & continue"}</button>
          <div className="flex items-center justify-between text-xs font-bold"><button type="button" onClick={()=>void sendSignupOtp()} disabled={loading || cooldown>0} className="text-[#5a4be8] disabled:text-gray-500">{cooldown>0 ? "Resend in " + cooldown + "s" : "Resend code"}</button><button type="button" onClick={resetAuthView} className="text-gray-500">Back</button></div>
        </form>
      ) : step === "forgot" ? (
        <form onSubmit={requestPasswordReset} className="space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Account email</span><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={17}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="you@example.com"/></div></label>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs leading-5 text-gray-500">We’ll send a 6-digit code that expires in 10 minutes. Never share your code with anyone.</div>
          {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
          <button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white shadow-lg shadow-gray-950/10 disabled:opacity-50">{loading ? "Sending code…" : "Send reset code"}</button>
          <button type="button" onClick={resetAuthView} className="w-full text-xs font-black text-gray-500">Back to sign in</button>
        </form>
      ) : step === "forgot-verify" ? (
        <form onSubmit={resetPassword} className="space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">6-digit reset code</span><input value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-center text-2xl font-black tracking-[.45em] outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="000000"/></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">New password</span><input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="At least 8 characters"/></label>
          {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
          {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">{notice}</div> : null}
          <button type="submit" disabled={loading || otp.length !== 6} className="h-12 w-full rounded-2xl bg-gray-950 text-sm font-black text-white shadow-lg shadow-gray-950/10 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Updating password…" : "Set new password"}</button>
          <div className="flex items-center justify-between text-xs font-bold"><button type="button" onClick={()=>void resendPasswordReset()} disabled={loading || cooldown>0} className="text-[#5a4be8] disabled:text-gray-500">{cooldown>0 ? "Resend in " + cooldown + "s" : "Send a new code"}</button><button type="button" onClick={()=>setStep("forgot")} className="text-gray-500">Change email</button></div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {signup && <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Full name</span><input value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" required className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="Your name"/></label>}
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Email</span><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={17}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="you@example.com"/></div></label>
          {signup && (() => {
            const previewUsername = email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._]/g, "").replace(/^[._]+|[._]+$/g, "").slice(0, 24) || "yourname";
            return (
              <div className="rounded-2xl border border-[#eeeaff] bg-[#f8f7ff] p-3 text-xs leading-5 text-gray-500" aria-live="polite">
                <span className="font-black text-gray-700">Username:</span> @{previewUsername} · You can change it later from your profile.
                {usernameAvailability === "checking" ? <span className="ml-2 font-bold text-gray-400">Checking availability…</span> : null}
                {usernameAvailability === "available" ? <span className="ml-2 font-bold text-emerald-600">Available</span> : null}
                {usernameAvailability === "taken" ? <span className="ml-2 font-bold text-amber-600">Already taken · a unique username will be generated.</span> : null}
              </div>
            );
          })()}
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Password</span><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={17}/><input type={show ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={8} required className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-20 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-[#6d5dfc]/10" placeholder="••••••••"/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-500 hover:bg-white">{show ? "Hide" : "Show"}</button></div></label>
          {!signup && <div className="flex items-center justify-between text-xs font-semibold text-gray-500"><label className="flex items-center gap-2"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="size-4 accent-[#6d5dfc]"/>Remember me</label><button type="button" onClick={()=>{setError("");setNotice("");setStep("forgot");}} className="font-black text-[#5a4be8] hover:text-[#4336c9]">Forgot password?</button></div>}
          {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div> : null}
          {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-700">{notice}</div> : null}
          <button type="submit" disabled={loading} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#161526] text-sm font-black text-white shadow-[0_14px_30px_rgba(22,21,38,.16)] transition hover:-translate-y-0.5 hover:bg-[#26233b] disabled:cursor-not-allowed disabled:opacity-60"><LogIn size={17}/>{loading ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>

          <div className="flex items-center gap-3 py-1" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-200"/>
            <span className="text-xs font-black uppercase tracking-[.16em] text-gray-500">or continue with</span>
            <span className="h-px flex-1 bg-gray-200"/>
          </div>

          <button type="button" onClick={() => void continueWithGoogle()} disabled={loading} className="group flex h-13 w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-sm font-black text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-[#4285F4] via-[#EA4335] via-50% to-[#34A853] text-sm font-black text-white shadow-sm">G</span>
            {loading ? "Connecting…" : "Continue with Google"}
          </button>
        </form>
      )}

      {step === "form" ? (
        <p className="mt-7 text-center text-sm text-gray-500">
          {signup ? <>Already have an account? <Link href="/login" className="font-black text-[#5a4be8] hover:text-[#4336c9]">Sign in</Link></> : <>New to Socialhub? <Link href="/signup" className="font-black text-[#5a4be8] hover:text-[#4336c9]">Create an account</Link></>}
        </p>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(109,93,252,.12),transparent_30%),radial-gradient(circle_at_90%_18%,rgba(54,184,255,.10),transparent_30%),#f6f7fb] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between rounded-[1.4rem] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_12px_35px_rgba(26,30,60,.07)] backdrop-blur-xl sm:px-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Socialhub home">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#6d5dfc] via-[#816fff] to-[#36b8ff] text-white shadow-lg shadow-[#6d5dfc]/25"><Sparkles size={18}/></span>
            <span><span className="block text-base font-black tracking-[-.035em] text-gray-950">Socialhub</span><span className="hidden text-xs font-bold text-gray-500 sm:block">Connect. Share. Belong.</span></span>
          </Link>
          <Link href={signup ? "/login" : "/signup"} className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-black text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50">
            {signup ? "Sign in" : "Create account"}
          </Link>
        </header>

        <div className="mt-4 grid overflow-hidden rounded-[2rem] border border-white/85 bg-white shadow-[0_30px_90px_rgba(37,31,84,.14)] lg:grid-cols-[.82fr_1.18fr]">
          <section className="hidden bg-[radial-gradient(circle_at_15%_5%,rgba(130,113,255,.65),transparent_34%),linear-gradient(145deg,#141223,#282149_62%,#19314a)] p-10 text-white lg:flex lg:min-h-[680px] lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[.16em] text-white/70">Socialhub</div>
              <h2 className="mt-10 max-w-md text-5xl font-black leading-[.94] tracking-[-.06em]">Your people.<br/>Your moments.<br/><span className="text-[#9c90ff]">Your space.</span></h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-white/60">A calmer social network for sharing the moments that matter, staying close to your people, and controlling your privacy.</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[["Private","Audience controls"],["Connected","Messages & friends"],["Personal","Your profile, your way"]].map(([label,copy]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/7 p-3">
                  <p className="text-xs font-black">{label}</p>
                  <p className="mt-1 text-xs leading-4 text-white/45">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 p-5 sm:p-8 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              {formShell}
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-3 px-1 pb-1 pt-5 text-xs font-bold text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[#eeebff] text-[#5a4be8]"><Sparkles size={13}/></span><span>Socialhub</span></div>
          <div className="flex items-center gap-4"><Link href="/login" className="hover:text-gray-600">Sign in</Link><Link href="/signup" className="hover:text-gray-600">Create account</Link><span>Secure & private</span></div>
        </footer>
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
  isVerified: boolean;
  isOwner: boolean;
  verifiedAt?: string | null;
  ownerSince?: string | null;
  createdAt: string;
  _count: { posts: number; followers: number; following: number };
  visibleCounts?: {
    posts: number;
    followers: number;
    following: number;
    likesReceived: number;
    commentsReceived: number;
    shares: number;
    profileViews: number;
  };
  isFollowing?: boolean;
  isFriend?: boolean;
  friendRequestStatus?: "SELF" | "NONE" | "FRIENDS" | "OUTGOING_PENDING" | "INCOMING_PENDING";
  friendRequestId?: string | null;
  canMessage?: boolean;
  canSendFriendRequest?: boolean;
  canFollow?: boolean;
  posts?: Array<{
    id: string;
    content: string | null;
    mediaUrl: string | null;
    isPinned: boolean;
    createdAt: string;
    shareCount?: number;
    liked?: boolean;
    saved?: boolean;
    displayCounts?: { likes: number; comments: number; shares: number };
    _count: { likes: number; comments: number };
  }>;
};

function ProfilePostCard({
  post,
  displayName,
  image,
  verified,
  owner,
  isOwner,
  onRemove,
  onPinnedChange,
}: {
  post: NonNullable<ProfileData["posts"]>[number];
  displayName: string;
  image: string | null;
  verified: boolean;
  owner: boolean;
  isOwner: boolean;
  onRemove: (postId: string) => void;
  onPinnedChange: (postId: string, pinned: boolean) => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [likeCount, setLikeCount] = useState(post.displayCounts?.likes ?? post._count.likes);
  const [shareCount, setShareCount] = useState(post.displayCounts?.shares ?? post.shareCount ?? 0);
  const [pinned, setPinned] = useState(post.isPinned);
  const [busy, setBusy] = useState<"like" | "save" | "share" | "report" | "delete" | "pin" | null>(null);
  const [message, setMessage] = useState("");

  async function toggleLike() {
    if (busy) return;
    setBusy("like");
    try {
      const response = await fetch("/api/posts/" + post.id + "/like", { method: liked ? "DELETE" : "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not update like.");
      setLiked(Boolean(json.liked));
      setLikeCount(Number(json.count ?? likeCount + (json.liked ? 1 : -1)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update like.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSave() {
    if (busy) return;
    setBusy("save");
    try {
      const response = await fetch("/api/posts/" + post.id + "/save", { method: saved ? "DELETE" : "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not update saved status.");
      setSaved(Boolean(json.saved));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update saved status.");
    } finally {
      setBusy(null);
    }
  }

  async function sharePost() {
    if (busy) return;
    const url = window.location.origin + "/home#post-" + post.id;
    setBusy("share");
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Socialhub post",
          text: (post.content ?? "Shared a new moment.").slice(0, 120),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      const response = await fetch("/api/posts/" + post.id + "/share", { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (response.ok) setShareCount(Number(json.shareCount ?? shareCount + 1));
      setMessage("Post link ready to share.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(error instanceof Error ? error.message : "Could not share post.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function reportPost() {
    const reason = window.prompt("Why are you reporting this post?", "Spam or misleading content");
    if (!reason?.trim() || busy) return;
    setBusy("report");
    try {
      const response = await fetch("/api/posts/" + post.id + "/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not report this post.");
      setMessage("Report submitted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not report this post.");
    } finally {
      setBusy(null);
    }
  }

  async function togglePin() {
    if (!isOwner || busy) return;
    setBusy("pin");
    try {
      const response = await fetch("/api/posts/" + post.id + "/pin", { method: pinned ? "DELETE" : "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not update pinned state.");
      const next = !pinned;
      setPinned(next);
      onPinnedChange(post.id, next);
      emitPostSyncEvent({ type: "pinned", postId: post.id, pinned: next });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update pinned state.");
    } finally {
      setBusy(null);
    }
  }

  async function deletePost() {
    if (!isOwner || busy || !window.confirm("Delete this post permanently?")) return;
    setBusy("delete");
    try {
      const response = await fetch("/api/posts/" + post.id, { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not delete this post.");
      onRemove(post.id);
      emitPostSyncEvent({ type: "deleted", postId: post.id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this post.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={"rounded-2xl border p-4 " + (pinned ? "border-[#d9d4ff] bg-[#f8f7ff]" : "border-gray-100 bg-gray-50")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {image ? <img src={image} alt="" className="size-9 rounded-full object-cover"/> : <Avatar initials={displayName.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()} size="sm"/>}
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs font-black">{displayName}<AccountBadge verified={verified} owner={owner}/></p>
            <p className="text-xs text-gray-500">{formatSocialDate(post.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isOwner ? <button type="button" onClick={() => void togglePin()} disabled={Boolean(busy)} className={"rounded-xl px-2.5 py-1.5 text-xs font-black " + (pinned ? "bg-[#6d5dfc] text-white" : "border border-gray-200 bg-white text-gray-500")}>{busy === "pin" ? "…" : pinned ? "Pinned" : "Pin"}</button> : pinned ? <span className="rounded-full bg-[#eeebff] px-2.5 py-1 text-xs font-black text-[#5a4be8]">Pinned</span> : null}
          {isOwner ? <button type="button" onClick={() => void deletePost()} disabled={Boolean(busy)} className="grid size-8 place-items-center rounded-xl border border-red-100 bg-white text-red-500" aria-label="Delete post"><Trash2 size={14}/></button> : <button type="button" onClick={() => void reportPost()} disabled={Boolean(busy)} className="grid size-8 place-items-center rounded-xl border border-gray-200 bg-white text-gray-500" aria-label="Report post"><Shield size={14}/></button>}
        </div>
      </div>
      {post.content ? <PostContent content={post.content} className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600"/> : null}
      {post.mediaUrl ? <img src={post.mediaUrl} alt="" className="mt-4 max-h-72 w-full rounded-xl object-cover" /> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={() => void toggleLike()} disabled={Boolean(busy)} title={fullCount(likeCount) + " likes"} aria-label={(liked ? "Unlike" : "Like") + " · " + fullCount(likeCount) + " likes"} className={"inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black " + (liked ? "bg-rose-50 text-rose-600" : "bg-white text-gray-500")}><Heart size={14} fill={liked ? "currentColor" : "none"}/>{compactCount(likeCount)}</button>
        <button type="button" onClick={() => router.push("/home#post-" + encodeURIComponent(post.id))} title={fullCount(post.displayCounts?.comments ?? post._count.comments) + " comments"} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-2 text-xs font-black text-gray-500"><MessageCircle size={14}/>{compactCount(post.displayCounts?.comments ?? post._count.comments)}</button>
        <button type="button" onClick={() => void toggleSave()} disabled={Boolean(busy)} className={"inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black " + (saved ? "bg-[#eeebff] text-[#5a4be8]" : "bg-white text-gray-500")}><Bookmark size={14} fill={saved ? "currentColor" : "none"}/>Save</button>
        <button type="button" onClick={() => void sharePost()} disabled={Boolean(busy)} title={fullCount(shareCount) + " shares"} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-2 text-xs font-black text-gray-500"><Share2 size={14}/>Share{shareCount ? " · " + compactCount(shareCount) : ""}</button>
      </div>
      {message ? <p className="mt-2 text-xs font-bold text-[#5a4be8]">{message}</p> : null}
    </article>
  );
}

function Profile({ username = "firdous" }: { username?: string }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [following, setFollowing] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<"SELF" | "NONE" | "FRIENDS" | "OUTGOING_PENDING" | "INCOMING_PENDING">("NONE");
  const [friendRequestId, setFriendRequestId] = useState<string | null>(null);
  const [canMessage, setCanMessage] = useState(true);
  const [canSendFriendRequest, setCanSendFriendRequest] = useState(true);
  const [canFollow, setCanFollow] = useState(true);
  const [actionLoading, setActionLoading] = useState<"follow" | "friend" | "cancel-friend" | "accept-friend" | "decline-friend" | "unfriend" | "message" | "report" | "block" | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState("");
  const [websiteError, setWebsiteError] = useState("");
  const [profileTab, setProfileTab] = useState<"posts" | "photos" | "friends">("posts");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuReady, setProfileMenuReady] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 0, left: 0 });
  const profileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [friends, setFriends] = useState<Array<{ id: string; name: string; username: string | null; image: string | null; bio: string | null; isVerified?: boolean; isOwner?: boolean }>>([]);
  const [friendsHidden, setFriendsHidden] = useState(false);
  const [relationshipView, setRelationshipView] = useState<"followers" | "following" | "mutual" | null>(null);
  const [relationships, setRelationships] = useState<{
    followers: Array<{ id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }>;
    following: Array<{ id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }>;
    mutual: Array<{ id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }>;
    hidden?: boolean;
    followersHidden?: boolean;
    followingHidden?: boolean;
    mutualHidden?: boolean;
  } | null>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [nextRelationshipBefore, setNextRelationshipBefore] = useState<string | null>(null);
  const [loadingMoreRelationships, setLoadingMoreRelationships] = useState(false);
  const [nextProfilePostsCursor, setNextProfilePostsCursor] = useState<string | null>(null);
  const [loadingMoreProfilePosts, setLoadingMoreProfilePosts] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username,
    bio: "",
    location: "",
    website: "",
    isPrivate: false,
  });

  useEffect(() => {
    setProfileMenuReady(true);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const reposition = () => {
      const anchor = profileMenuButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 190;
      const gap = 8;
      setProfileMenuPosition({
        top: Math.min(window.innerHeight - 210, rect.bottom + gap),
        left: Math.min(window.innerWidth - width - 10, Math.max(10, rect.right - width)),
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target) && !profileMenuButtonRef.current?.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [profileMenuOpen]);

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
        setFriendRequestStatus(next.friendRequestStatus ?? (next.isFriend ? "FRIENDS" : "NONE"));
        setFriendRequestId(next.friendRequestId ?? null);
        setCanMessage(next.canMessage ?? true);
        setCanSendFriendRequest(next.canSendFriendRequest ?? true);
        setCanFollow(next.canFollow ?? true);
        setFriends([]);
        setFriendsHidden(false);
        setRelationships(null);
        setRelationshipView(null);
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
    if (!profile) return;
    let cancelled = false;
    void fetch("/api/users/" + encodeURIComponent(profile.username ?? username) + "/posts?take=20", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load profile posts.");
        if (!cancelled) {
          setProfile((current) => current ? { ...current, posts: json.posts ?? [] } : current);
          setNextProfilePostsCursor(json.nextBefore ?? null);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load profile posts.");
      });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.username, username]);

  async function loadMoreProfilePosts() {
    if (!profile || !nextProfilePostsCursor || loadingMoreProfilePosts) return;
    setLoadingMoreProfilePosts(true);
    try {
      const response = await fetch("/api/users/" + encodeURIComponent(profile.username ?? username) + "/posts?take=20&before=" + encodeURIComponent(nextProfilePostsCursor), { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not load older profile posts.");
      setProfile((current) => current ? { ...current, posts: [...(current.posts ?? []), ...(json.posts ?? [])] } : current);
      setNextProfilePostsCursor(json.nextBefore ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load older profile posts.");
    } finally {
      setLoadingMoreProfilePosts(false);
    }
  }

  useEffect(() => {
    if (profileTab !== "friends" || !profile) return;
    let cancelled = false;
    void fetch(isOwner ? "/api/friends" : "/api/users/" + encodeURIComponent(profile.id) + "/friends", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load friends.");
        if (!cancelled) {
          setFriends(json.friends ?? []);
          setFriendsHidden(Boolean(json.hidden));
        }
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
      setNextRelationshipBefore(view === "followers" ? (json.nextFollowersBefore ?? null) : view === "following" ? (json.nextFollowingBefore ?? null) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load relationships.");
      setRelationshipView(null);
    } finally {
      setLoadingRelationships(false);
    }
  }

  async function loadMoreRelationships(view: "followers" | "following") {
    if (!profile || !nextRelationshipBefore || loadingMoreRelationships) return;
    setLoadingMoreRelationships(true);
    try {
      const response = await fetch("/api/users/" + encodeURIComponent(profile.id) + "/relationships?list=" + view + "&take=50&before=" + encodeURIComponent(nextRelationshipBefore), { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not load more relationships.");
      setRelationships((current) => current ? {
        ...current,
        [view]: [...(current[view] ?? []), ...(json[view] ?? [])],
      } : current);
      setNextRelationshipBefore(json.nextBefore ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load more relationships.");
    } finally {
      setLoadingMoreRelationships(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user || saving) return;
    setSaving(true);
    setError("");
    setWebsiteError("");

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
      const message = requestError instanceof Error ? requestError.message : "Could not update profile.";
      if (/url/i.test(message) && form.website.trim()) setWebsiteError(message);
      else setError(message);
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
  const visibleCounts = profile?.visibleCounts;
  const postCount = visibleCounts?.posts ?? profile?._count.posts ?? 0;
  const followerCount = visibleCounts?.followers ?? profile?._count.followers ?? 0;
  const followingCount = visibleCounts?.following ?? profile?._count.following ?? 0;
  const likesReceivedCount = visibleCounts?.likesReceived ?? 0;
  const commentsReceivedCount = visibleCounts?.commentsReceived ?? 0;
  const shareCount = visibleCounts?.shares ?? 0;
  const profileViewCount = visibleCounts?.profileViews ?? 0;
  const visibleProfilePosts = (profile?.posts ?? []).filter((post) =>
    profileTab === "photos" ? Boolean(post.mediaUrl) : true,
  );
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase() || "SH";

  async function toggleFollow() {
    if (!session?.user || isOwner || !profile || actionLoading) return;
    setActionLoading("follow");
    try {
      const response = await fetch("/api/users/" + profile.id + "/follow", { method: following ? "DELETE" : "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not update follow status.");
      const nextFollowing = Boolean(json.following);
      setFollowing(nextFollowing);
      emitLiveSync({ type: "follow-updated", userId: profile.id, following: nextFollowing });
      setProfile((current) => current ? {
        ...current,
        _count: {
          ...current._count,
          followers: Math.max(0, current._count.followers + (nextFollowing ? 1 : -1)),
        },
      } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update follow status.");
    } finally {
      setActionLoading(null);
    }
  }

  async function sendFriendRequest() {
    if (!profile || isOwner || !session?.user || !canSendFriendRequest || actionLoading) return;
    setActionLoading("friend");
    try {
      const response = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: profile.id }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not send friend request.");
      setFriendRequestStatus("OUTGOING_PENDING");
      setFriendRequestId(json.friendRequest?.id ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send friend request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelFriendRequest() {
    if (!friendRequestId || actionLoading) return;
    setActionLoading("cancel-friend");
    try {
      const response = await fetch("/api/friend-requests/" + encodeURIComponent(friendRequestId), { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not cancel friend request.");
      setFriendRequestStatus("NONE");
      setFriendRequestId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not cancel friend request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function acceptFriendRequest() {
    if (!friendRequestId || !profile || actionLoading) return;
    setActionLoading("accept-friend");
    try {
      const response = await fetch("/api/friend-requests/" + encodeURIComponent(friendRequestId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not accept friend request.");
      setFriendRequestStatus("FRIENDS");
      setFriendRequestId(null);
      setFollowing(true);
      emitLiveSync({ type: "follow-updated", userId: profile.id, following: true });
      setCanMessage(true);
      setProfile((current) => current ? {
        ...current,
        isFriend: true,
        _count: {
          ...current._count,
          followers: current._count.followers + 1,
          following: current._count.following + 1,
        },
      } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not accept friend request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function declineFriendRequest() {
    if (!friendRequestId || actionLoading) return;
    setActionLoading("decline-friend");
    try {
      const response = await fetch("/api/friend-requests/" + encodeURIComponent(friendRequestId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DECLINED" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not decline friend request.");
      setFriendRequestStatus("NONE");
      setFriendRequestId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not decline friend request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function unfriendUser() {
    if (!profile || isOwner || actionLoading) return;
    if (!window.confirm("Remove this person from your friends?")) return;
    setActionLoading("unfriend");
    try {
      const response = await fetch("/api/friends/" + encodeURIComponent(profile.id), { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not remove this friendship.");
      setFriendRequestStatus("NONE");
      setFriendRequestId(null);
      setFollowing(false);
      emitLiveSync({ type: "follow-updated", userId: profile.id, following: false });
      setProfile((current) => current ? {
        ...current,
        isFriend: false,
        _count: {
          ...current._count,
          followers: Math.max(0, current._count.followers - 1),
          following: Math.max(0, current._count.following - 1),
        },
      } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove this friendship.");
    } finally {
      setActionLoading(null);
    }
  }

  async function startMessage() {
    if (!profile || isOwner || !session?.user || !canMessage || actionLoading) return;
    setActionLoading("message");
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
      setActionLoading(null);
    }
  }

  async function reportUser() {
    if (!profile || isOwner || actionLoading) return;
    const reason = window.prompt("Why are you reporting this profile?", "Spam or misleading profile");
    if (!reason?.trim()) return;
    setActionLoading("report");
    try {
      const response = await fetch("/api/users/" + profile.id + "/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not submit the report.");
      }
      setError("Report submitted. Thank you for helping keep Socialhub safe.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit the report.");
    } finally {
      setActionLoading(null);
    }
  }

  async function blockUser() {
    if (!profile || isOwner || actionLoading) return;
    if (!window.confirm("Block this user? Their content will no longer appear for you.")) return;
    setActionLoading("block");
    try {
      const response = await fetch("/api/users/" + profile.id + "/block", { method: "POST" });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not block this user.");
      }
      router.push("/home");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not block this user.");
      setActionLoading(null);
    }
  }

  if (!profile) {
    return (
      <Page eyebrow="Profile" title={displayName || "Profile"}>
        {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}
        <div className="rounded-[2rem] border border-gray-200/70 bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-[0_14px_40px_rgba(20,24,40,.06)]">
          {error ? "Profile unavailable." : "Loading profile…"}
        </div>
      </Page>
    );
  }

  return <Page eyebrow="Profile" title={displayName || "Profile"}>
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

    <div className="overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)]">
      <div
        className="relative h-40 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.24),transparent_22%),linear-gradient(135deg,#5a4be8,#2e9fe9_55%,#51d3b4)] bg-cover bg-center sm:h-[220px]"
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
            {uploading === "cover" ? <span className="absolute right-4 bottom-4 rounded-full bg-black/45 px-3 py-1.5 text-xs font-black text-white backdrop-blur">Uploading cover…</span> : null}
          </>
        ) : null}
      </div>

      <div className="relative min-w-0 px-4 pb-6 sm:px-8">
        <div className="-mt-12 flex min-w-0 flex-col gap-3 sm:-mt-14">
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
                    <img src={profile.image} alt={`${displayName} profile picture`} className="size-24 rounded-full object-cover text-xs shadow-sm" />
                  ) : (
                    <Avatar initials={initials} size="xl"/>
                  )}
                </label>
              </>
            ) : profile?.image ? (
              <img src={profile.image} alt={`${displayName} profile picture`} className="size-24 rounded-full object-cover text-xs shadow-sm" />
            ) : (
              <Avatar initials={initials} size="xl"/>
            )}
          </div>
          <div className="min-w-0 flex-1 sm:pb-2"><h2 className="flex min-w-0 items-center gap-2 text-xl font-black tracking-[-.04em] sm:text-2xl"><span className="min-w-0 truncate">{displayName}</span><AccountBadge verified={profile?.isVerified} owner={profile?.isOwner} showLabel size="md"/></h2><p className="mt-0.5 break-all text-xs font-semibold text-gray-500">@{displayUsername}{profile?.location ? ` · ${profile.location}` : ""}</p></div>
        </div>

        {uploading === "avatar" ? <p className="mt-3 text-xs font-bold text-[#5a4be8]">Uploading profile picture…</p> : null}

        {!editing ? (
          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="sr-only">Profile actions</span>
              {friendRequestStatus === "FRIENDS" ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"><Check size={12}/>Friends</span> : null}
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {isOwner ? (
                <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white shadow-sm"><Pencil size={15}/>Edit profile</button>
              ) : session?.user ? (
                <>
                  {friendRequestStatus === "FRIENDS" ? (
                    <button type="button" onClick={() => void unfriendUser()} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700 disabled:opacity-50"><Users size={15}/>{actionLoading === "unfriend" ? "Removing…" : "Unfriend"}</button>
                  ) : friendRequestStatus === "INCOMING_PENDING" ? (
                    <>
                      <button type="button" onClick={() => void acceptFriendRequest()} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6d5dfc] px-4 text-xs font-black text-white disabled:opacity-50"><Check size={15}/>{actionLoading === "accept-friend" ? "Accepting…" : "Accept friend"}</button>
                      <button type="button" onClick={() => void declineFriendRequest()} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700 disabled:opacity-50"><X size={15}/>{actionLoading === "decline-friend" ? "Declining…" : "Decline"}</button>
                    </>
                  ) : friendRequestStatus === "OUTGOING_PENDING" ? (
                    <>
                      <button type="button" disabled className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d4ff] bg-[#f6f3ff] px-4 text-xs font-black text-[#5a4be8]"><Check size={15}/>Request sent</button>
                      <button type="button" onClick={() => void cancelFriendRequest()} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700 disabled:opacity-50"><X size={15}/>{actionLoading === "cancel-friend" ? "Cancelling…" : "Cancel request"}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void sendFriendRequest()} disabled={!canSendFriendRequest || Boolean(actionLoading)} className={"inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-black " + (canSendFriendRequest ? "bg-[#6d5dfc] text-white disabled:opacity-50" : "cursor-not-allowed bg-gray-100 text-gray-500")}><UserPlus size={15}/>{actionLoading === "friend" ? "Sending…" : canSendFriendRequest ? "Add friend" : "Friend requests off"}</button>
                  )}
                  {friendRequestStatus !== "FRIENDS" && canFollow && (!profile?.isPrivate || friendRequestStatus === "INCOMING_PENDING") ? (
                    <button type="button" onClick={() => void toggleFollow()} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700 disabled:opacity-50"><Users size={15}/>{actionLoading === "follow" ? "Updating…" : following ? "Following" : "Follow"}</button>
                  ) : null}
                  <button type="button" onClick={() => void startMessage()} disabled={!canMessage || Boolean(actionLoading)} className={"inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-black " + (canMessage ? "border-gray-200 bg-white text-gray-700 disabled:opacity-50" : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-500")}><MessageCircle size={15}/>{actionLoading === "message" ? "Opening…" : canMessage ? "Message" : "Messages off"}</button>

                  <button type="button" onClick={() => void blockUser()} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-700 disabled:opacity-50"><ShieldOff size={15}/>Block</button>
                </>
              ) : (
                <Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-xs font-black text-white"><LogIn size={15}/>Sign in to interact</Link>
              )}
              <div className="relative shrink-0"><button ref={profileMenuButtonRef} type="button" onClick={() => setProfileMenuOpen((value) => !value)} className="grid size-11 place-items-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm" aria-label="More profile actions" aria-expanded={profileMenuOpen} aria-haspopup="menu"><MoreHorizontal size={18}/></button></div>
            </div>
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={saveProfile} className="mt-6 grid gap-4 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] p-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Display name</span><input value={form.name} onChange={(e)=>setForm((value)=>({...value,name:e.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Username</span><input value={form.username} onChange={(e)=>setForm((value)=>({...value,username:e.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-bold text-gray-600">Bio</span><textarea value={form.bio} onChange={(e)=>setForm((value)=>({...value,bio:e.target.value}))} className="min-h-24 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm"/></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Location</span><input value={form.location} onChange={(e)=>setForm((value)=>({...value,location:e.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-600">Website</span><input type="url" value={form.website} onChange={(e)=>{ setWebsiteError(""); setForm((value)=>({...value,website:e.target.value})); }} placeholder="https://example.com" aria-invalid={Boolean(websiteError)} aria-describedby={websiteError ? "profile-website-error" : undefined} className={"h-11 w-full rounded-xl border bg-white px-3 text-sm " + (websiteError ? "border-red-300" : "border-gray-200")}/>{websiteError ? <span id="profile-website-error" className="mt-1.5 block text-xs font-bold text-red-600">{websiteError}</span> : null}</label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:col-span-2"><input type="checkbox" checked={form.isPrivate} onChange={(e)=>setForm((value)=>({...value,isPrivate:e.target.checked}))} className="size-4 accent-[#6d5dfc]"/><span><span className="block text-xs font-black text-gray-700">Private account</span><span className="mt-0.5 block text-xs text-gray-500">Limit profile posts to you and accepted friends.</span></span></label>
            <div className="flex items-end justify-end sm:col-span-2"><button disabled={saving} type="submit" className="h-11 rounded-xl bg-[#6d5dfc] px-4 text-xs font-black text-white disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div>
          </form>
        ) : (
          <>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-600">{profile?.bio ?? form.bio}</p>
            <div className="mt-5 w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
  <div className="grid grid-cols-3 divide-x divide-gray-100">
    <div className="px-3 py-3 text-center" title={fullCount(postCount) + " posts"}><strong className="block text-xl font-black">{compactCount(postCount)}</strong><span className="text-xs font-bold uppercase tracking-[.08em] text-gray-500">posts</span></div>
    <button type="button" onClick={() => void openRelationships("followers")} title={fullCount(followerCount) + " followers"} className="px-3 py-3 text-center hover:bg-white"><strong className="block text-base font-black">{compactCount(followerCount)}</strong><span className="text-xs font-bold uppercase tracking-[.08em] text-gray-500">followers</span></button>
    <button type="button" onClick={() => void openRelationships("following")} title={fullCount(followingCount) + " following"} className="px-3 py-3 text-center hover:bg-white"><strong className="block text-base font-black">{compactCount(followingCount)}</strong><span className="text-xs font-bold uppercase tracking-[.08em] text-gray-500">following</span></button>
  </div>
  <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2.5">
    <span className="text-xs font-black text-gray-500" title={fullCount(likesReceivedCount) + " likes"}><span className="text-[#5a4be8]">{compactCount(likesReceivedCount)}</span> likes</span>
    <span className="text-gray-200">·</span>
    <span className="text-xs font-black text-gray-500" title={fullCount(commentsReceivedCount) + " comments"}><span className="text-[#5a4be8]">{compactCount(commentsReceivedCount)}</span> comments</span>
    <span className="text-gray-200">·</span>
    <span className="text-xs font-black text-gray-500" title={fullCount(shareCount) + " shares"}><span className="text-[#5a4be8]">{compactCount(shareCount)}</span> shares</span>
    <span className="text-gray-200">·</span>
    <span className="text-xs font-black text-gray-500" title={fullCount(profileViewCount) + " views"}><span className="text-[#5a4be8]">{compactCount(profileViewCount)}</span> views</span>
    {!isOwner && session?.user && relationships?.mutual?.length ? <button type="button" onClick={() => void openRelationships("mutual")} title={fullCount(relationships.mutual.length) + " mutual"} className="ml-auto rounded-full bg-[#eeebff] px-2.5 py-1 text-xs font-bold text-[#5a4be8]">{compactCount(relationships.mutual.length)} mutual</button> : null}
  </div>
</div>
          </>
        )}

        <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2">
          {profile?.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-[#5a4be8] hover:bg-[#eeebff]">{profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : null}
          {profile?.isPrivate ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Private account</span> : null}
          {profile?.createdAt ? <span className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">Joined {formatJoinedDate(profile.createdAt)}</span> : null}
        </div>
        {relationshipView ? (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={relationshipView}>
            <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5"><div><h3 className="text-base font-black">{relationshipView === "followers" ? "Followers" : relationshipView === "following" ? "Following" : "Mutual friends"}</h3><p className="mt-1 text-xs text-gray-500">Real account relationships</p></div><button type="button" onClick={() => setRelationshipView(null)} className="grid size-9 place-items-center rounded-xl bg-gray-100" aria-label="Close"><X size={16}/></button></div>
              {loadingRelationships ? <div className="p-8 text-center text-xs text-gray-500">Loading…</div> : (
                <div className="max-h-[60vh] overflow-y-auto p-3">
                  {(() => {
                    const list = relationships?.[relationshipView] ?? [];
                    const hidden = relationshipView === "followers"
                      ? relationships?.followersHidden
                      : relationshipView === "following"
                        ? relationships?.followingHidden
                        : relationships?.mutualHidden;
                    if (hidden) {
                      return <div className="p-8 text-center"><Lock className="mx-auto text-gray-500" size={20}/><p className="mt-3 text-sm font-black">This list is private</p><p className="mt-1 text-xs text-gray-500">The account owner has chosen not to show this relationship list.</p></div>;
                    }
                    return list.length ? <>
                      {list.map((person) => <Link key={person.id} href={"/profile/" + encodeURIComponent(person.username ?? person.id)} onClick={() => setRelationshipView(null)} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-gray-50">
                        {person.image ? <img src={person.image} alt="" className="size-11 rounded-full object-cover"/> : <span className="grid size-11 place-items-center rounded-full bg-[#eeebff] text-xs font-black text-[#5a4be8]">{person.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span>}
                        <span className="min-w-0"><span className="flex items-center gap-1 truncate text-sm font-black">{person.name}<AccountBadge verified={person.isVerified} owner={person.isOwner}/></span><span className="block truncate text-xs text-gray-500">@{person.username ?? "member"}</span></span>
                      </Link>)}
                      {nextRelationshipBefore && relationshipView !== "mutual" ? <button type="button" onClick={() => void loadMoreRelationships(relationshipView)} disabled={loadingMoreRelationships} className="mx-auto my-2 block rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-600 disabled:opacity-50">{loadingMoreRelationships ? "Loading…" : "Load more"}</button> : null}
                    </> : <div className="p-8 text-center text-xs text-gray-500">No accounts to show.</div>;
                  })()}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {profileMenuOpen && profileMenuReady
          ? createPortal(
              <div
                ref={profileMenuRef}
                className="fixed z-[9999] w-[190px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl"
                style={{ top: profileMenuPosition.top, left: profileMenuPosition.left }}
                role="menu"
                aria-label="Profile actions"
              >
                <button type="button" onClick={() => { setProfileMenuOpen(false); void shareProfile(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50" role="menuitem"><Share2 size={15}/>Share profile</button>
                {!isOwner ? <>
                  <button type="button" onClick={() => { setProfileMenuOpen(false); void reportUser(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50" role="menuitem"><Shield size={15}/>Report</button>
                  <button type="button" onClick={() => { setProfileMenuOpen(false); void blockUser(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50" role="menuitem"><ShieldOff size={15}/>Block</button>
                </> : null}
              </div>,
              document.body,
            )
          : null}

        <div className="mt-7 flex gap-2 overflow-x-auto border-b border-gray-100 pb-3 text-xs font-black scrollbar-none">
          {(["posts","photos","friends"] as const).map((tab) => <button key={tab} type="button" onClick={() => setProfileTab(tab)} className={profileTab === tab ? "border-b-2 border-[#6d5dfc] pb-3 text-[#5a4be8]" : "pb-3 text-gray-500"}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
        </div>
        {profileTab === "friends" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {friendsHidden ? <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center"><Lock className="mx-auto text-gray-500" size={20}/><p className="mt-3 text-sm font-black">Friends are private</p><p className="mt-1 text-xs text-gray-500">Only the account owner and accepted friends can view this list.</p></div> : friends.length ? friends.map((friend) => <Link key={friend.id} href={"/profile/" + encodeURIComponent(friend.username ?? friend.id)} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white">
              {friend.image ? <img src={friend.image} alt={friend.name} className="size-11 rounded-full object-cover"/> : <Avatar initials={friend.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} size="md"/>}
              <span className="min-w-0"><span className="flex items-center gap-1 truncate text-sm font-black">{friend.name}<AccountBadge verified={friend.isVerified} owner={friend.isOwner}/></span><span className="block truncate text-xs text-gray-500">@{friend.username ?? "member"}</span></span>
            </Link>) : <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center"><p className="text-sm font-black">No friends to show yet</p><p className="mt-1 text-xs text-gray-500">Accepted connections will appear here.</p></div>}
          </div>
        ) : profileTab === "photos" ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {visibleProfilePosts.length ? visibleProfilePosts.map((post) => post.mediaUrl ? (
              <Link key={post.id} href={"/home#post-" + encodeURIComponent(post.id)} className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
                <img src={post.mediaUrl} alt={post.content ? post.content.slice(0, 80) : "Profile photo"} className="size-full object-cover transition duration-200 group-hover:scale-[1.02]"/>
              </Link>
            ) : null) : <div className="col-span-3 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center"><p className="text-sm font-black">No photos yet</p><p className="mt-1 text-xs text-gray-500">{isOwner ? "Share a post with a photo to build your gallery." : "This profile has not shared any photos."}</p></div>}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {visibleProfilePosts.length > 0 ? visibleProfilePosts.map((post) => (
              <ProfilePostCard
                key={post.id}
                post={post}
                displayName={displayName}
                image={profile?.image ?? null}
                verified={Boolean(profile?.isVerified)}
                owner={Boolean(profile?.isOwner)}
                isOwner={isOwner}
                onRemove={(postId) => {
                  setProfile((current) => current ? {
                    ...current,
                    posts: (current.posts ?? []).filter((item) => item.id !== postId),
                  } : current);
                }}
                onPinnedChange={(postId, pinned) => {
                  setProfile((current) => current ? {
                    ...current,
                    posts: (current.posts ?? []).map((item) => ({
                      ...item,
                      isPinned: item.id === postId ? pinned : pinned ? false : item.isPinned,
                    })),
                  } : current);
                }}
              />
            )) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="text-sm font-black">No public posts yet</p>
                <p className="mt-1 text-xs text-gray-500">{isOwner ? "Share your first post from the home feed." : "This profile has not shared any public posts."}</p>
              </div>
            )}
            {nextProfilePostsCursor ? (
              <div className="mt-4 flex justify-center">
                <button type="button" onClick={() => void loadMoreProfilePosts()} disabled={loadingMoreProfilePosts} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-600 disabled:opacity-50">
                  {loadingMoreProfilePosts ? "Loading older posts…" : "Load older posts"}
                </button>
              </div>
            ) : null}
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
  editedAt?: string | null;
  deletedAt?: string | null;
  replyTo?: { id: string; content: string; senderId: string; sender: { id: string; name: string; username: string | null } } | null;
  sender: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
  attachments?: Array<{ id: string; url: string; kind: string }>;
  reactions?: Array<{ id: string; emoji: string; userId: string; user: { id: string; name: string; image: string | null } }>;
};

type ConversationData = {
  id: string;
  title: string | null;
  isGroup: boolean;
  unreadCount?: number;
  mutedUntil?: string | null;
  archivedAt?: string | null;
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean };
    lastReadAt?: string | null;
  }>;
  messages: Array<{ id: string; senderId: string; content: string; createdAt: string }>;
};

class MessagesErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string | null },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  componentDidUpdate(previousProps: { resetKey?: string | null }) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><MessageCircle size={20}/></span>
          <p className="mt-3 text-sm font-black">Couldn’t open chat</p>
          <p className="mt-1 text-xs text-gray-500">Something went wrong while rendering this conversation.</p>
          <button type="button" onClick={() => this.setState({ hasError: false })} className="mt-4 rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white">Retry</button>
        </div>
      </div>
    );
  }
}

function normalizeConversation(value: Partial<ConversationData> & { id: string }): ConversationData {
  return {
    id: value.id,
    title: value.title ?? null,
    isGroup: Boolean(value.isGroup),
    unreadCount: value.unreadCount ?? 0,
    mutedUntil: value.mutedUntil ?? null,
    archivedAt: value.archivedAt ?? null,
    members: Array.isArray(value.members) ? value.members : [],
    messages: Array.isArray(value.messages) ? value.messages : [],
  };
}

function Messages({ initialConversationId }: { initialConversationId?: string }) {
  const { data: session } = authClient.useSession();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string; image: string | null }>>([]);
  const [nextMessagesCursor, setNextMessagesCursor] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [showArchivedConversations, setShowArchivedConversations] = useState(false);
  const [showConversationOptions, setShowConversationOptions] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupTitleDraft, setGroupTitleDraft] = useState("");
  const [groupUserQuery, setGroupUserQuery] = useState("");
  const [groupPeople, setGroupPeople] = useState<Array<{ id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }>>([]);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }>>([]);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const attachmentRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationsPollRef = useRef(false);
  const messagesPollRef = useRef(false);
  const typingPollRef = useRef(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const lastReadAttemptRef = useRef(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateViewportHeight = () => {
      document.documentElement.style.setProperty("--messages-vh", viewport.height + "px");
    };
    updateViewportHeight();
    viewport.addEventListener("resize", updateViewportHeight);
    viewport.addEventListener("scroll", updateViewportHeight);
    return () => {
      viewport.removeEventListener("resize", updateViewportHeight);
      viewport.removeEventListener("scroll", updateViewportHeight);
      document.documentElement.style.removeProperty("--messages-vh");
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    if (!session?.user?.id || !activeId) {
      setDraft("");
      return;
    }
    try {
      setDraft(window.localStorage.getItem("socialhub:draft:" + session.user.id + ":" + activeId) ?? "");
    } catch {
      setDraft("");
    }
  }, [session?.user?.id, activeId]);

  useEffect(() => {
    if (!session?.user?.id || !activeId) return;
    try {
      const key = "socialhub:draft:" + session.user.id + ":" + activeId;
      if (draft.trim()) window.localStorage.setItem(key, draft);
      else window.localStorage.removeItem(key);
    } catch {}
  }, [session?.user?.id, activeId, draft]);

  const markConversationRead = useCallback(async () => {
    if (!activeId || !session?.user) return;
    const now = Date.now();
    if (now - lastReadAttemptRef.current < 3000) return;
    lastReadAttemptRef.current = now;
    try {
      const response = await fetch("/api/conversations/" + activeId + "/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      });
      if (!response.ok) return;
      setConversations((current) => current.map((conversation) =>
        conversation.id === activeId ? { ...conversation, unreadCount: 0 } : conversation,
      ));
      emitUnreadSummarySync();
    } catch {
      // Read state is best-effort and must never block messaging.
    }
  }, [activeId, session?.user?.id]);

  useEffect(() => {
    lastReadAttemptRef.current = 0;
    messagesRef.current = [];
    setNewMessagesCount(0);
    setNextMessagesCursor(null);
    setDraft("");
    setPendingAttachments([]);
    setReplyingToMessage(null);
  }, [activeId]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node || !activeId || !session?.user) return;
    const onScroll = () => {
      if (node.scrollHeight - node.scrollTop - node.clientHeight < 96) {
        void markConversationRead();
      }
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [activeId, session?.user?.id, markConversationRead]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations(silent = false) {
      if (!silent) setLoading(true);
      setError("");
      if (!session?.user) {
        setConversations([]);
        setActiveId(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/conversations" + (showArchivedConversations ? "?includeArchived=true" : ""), { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load conversations.");
        if (cancelled) return;
        const next = Array.isArray(json.conversations)
          ? (json.conversations as Array<Partial<ConversationData> & { id: string }>).map(normalizeConversation)
          : [];
        setConversations(next);
        setActiveId((current) => {
          if (initialConversationId && next.some((conversation) => conversation.id === initialConversationId)) return initialConversationId;
          if (current && next.some((conversation) => conversation.id === current)) return current;
          if (current === null) return window.matchMedia("(max-width: 1023px)").matches ? null : next[0]?.id ?? null;
          return next[0]?.id ?? null;
        });
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load conversations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConversations();
    const poll = async () => {
      if (conversationsPollRef.current || document.visibilityState !== "visible" || navigator.onLine === false) return;
      conversationsPollRef.current = true;
      try { await loadConversations(true); } finally { conversationsPollRef.current = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.user?.id, initialConversationId, showArchivedConversations]);

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
      if (!json.conversation?.id) throw new Error("The conversation was created, but its details were not returned.");
      const conversation = normalizeConversation(json.conversation as Partial<ConversationData> & { id: string });
      setConversations((current) => {
        const existing = current.find((item) => item.id === conversation.id);
        return existing
          ? current.map((item) => item.id === conversation.id ? normalizeConversation({ ...item, ...conversation, members: conversation.members.length ? conversation.members : item.members, messages: conversation.messages.length ? conversation.messages : item.messages }) : item)
          : [conversation, ...current];
      });
      setActiveId(conversation.id);
      setNewConversationOpen(false);
      setUserQuery("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start conversation.");
    }
  }

  async function uploadAttachments(files: File[]) {
    if (!files.length || uploadingAttachment || pendingAttachments.length >= 4) return;
    const available = Math.max(0, 4 - pendingAttachments.length);
    setUploadingAttachment(true);
    setError("");
    const uploaded: string[] = [];
    let uploadError = "";
    try {
      for (const file of files.slice(0, available)) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/uploads", { method: "POST", body: formData });
          const json = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(json.error ?? "Could not upload attachment.");
          if (typeof json.url === "string") uploaded.push(json.url);
        } catch (requestError) {
          uploadError = requestError instanceof Error ? requestError.message : "Could not upload attachment.";
          break;
        }
      }
      if (uploaded.length) {
        setPendingAttachments((current) => [...current, ...uploaded].slice(0, 4));
      }
      if (uploadError) setError(uploadError);
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
        const response = await fetch("/api/conversations/" + activeId + "/messages", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load messages.");

        if (!cancelled) {
          const nextMessages = json.messages as ChatMessage[];
          const currentMessages = messagesRef.current;
          const initialLoad = currentMessages.length === 0;
          const currentIds = new Set(currentMessages.map((message) => message.id));
          const incomingMessages = initialLoad
            ? []
            : nextMessages.filter((message) => !currentIds.has(message.id));
          const fetchedIds = new Set(nextMessages.map((message) => message.id));
          const olderAlreadyLoaded = currentMessages.length > nextMessages.length;
          const mergedMessages = olderAlreadyLoaded
            ? [...currentMessages.filter((message) => !fetchedIds.has(message.id)), ...nextMessages]
            : nextMessages;

          const container = messageListRef.current;
          const nearBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 140;
          setMessages(mergedMessages);

          if (incomingMessages.length) {
            if (nearBottom) setNewMessagesCount(0);
            else setNewMessagesCount((count) => count + incomingMessages.length);
          }

          if (!olderAlreadyLoaded) {
            setNextMessagesCursor(json.nextBefore ?? null);
          }

          if (initialLoad || (incomingMessages.length > 0 && nearBottom)) {
            window.requestAnimationFrame(() => {
              if (messageListRef.current) {
                messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
              }
            });
            void markConversationRead();
          }
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load messages.");
      }
    }

    void loadMessages();
    const poll = async () => {
      if (messagesPollRef.current || document.visibilityState !== "visible" || navigator.onLine === false) return;
      messagesPollRef.current = true;
      try { await loadMessages(); } finally { messagesPollRef.current = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeId, session?.user?.id, markConversationRead]);

  useEffect(() => {
    if (!activeId || !session?.user) {
      setTypingUsers([]);
      return;
    }

    let cancelled = false;
    async function refreshTyping() {
      try {
        const response = await fetch("/api/conversations/" + activeId + "/typing", { cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setTypingUsers(json.typing ?? []);
      } catch {
        // Typing presence is best-effort and must never block messaging.
      }
    }

    void refreshTyping();
    const poll = async () => {
      if (typingPollRef.current || document.visibilityState !== "visible" || navigator.onLine === false) return;
      typingPollRef.current = true;
      try { await refreshTyping(); } finally { typingPollRef.current = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      setTypingUsers([]);
    };
  }, [activeId, session?.user?.id]);

  useEffect(() => {
    if (!activeId || !session?.user || !draft.trim()) {
      if (activeId && session?.user) {
        void fetch("/api/conversations/" + activeId + "/typing", { method: "DELETE" }).catch(() => {});
      }
      return;
    }

    let cancelled = false;
    const publish = async () => {
      if (cancelled) return;
      try {
        await fetch("/api/conversations/" + activeId + "/typing", { method: "POST" });
      } catch {
        // Best-effort presence.
      }
    };
    const initial = window.setTimeout(() => void publish(), 180);
    const heartbeat = window.setInterval(() => void publish(), 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(heartbeat);
    };
  }, [activeId, session?.user?.id, draft]);

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

  async function editMessage(messageId: string) {
    if (!editingMessageText.trim() || savingMessage) return;
    setSavingMessage(true);
    setError("");
    try {
      const response = await fetch("/api/messages/" + messageId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", content: editingMessageText.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not edit message.");
      setMessages((current) => current.map((item) => item.id === messageId ? { ...item, ...json.message } : item));
      emitLiveSync({ type: "message-updated", conversationId: activeId ?? "", messageId });
      setEditingMessageId(null);
      setEditingMessageText("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not edit message.");
    } finally {
      setSavingMessage(false);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("Delete this message?")) return;
    setError("");
    try {
      const response = await fetch("/api/messages/" + messageId, { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not delete message.");
      setMessages((current) => current.map((item) => item.id === messageId ? { ...item, ...json.message, deletedAt: json.message.deletedAt } : item));
      emitLiveSync({ type: "message-deleted", conversationId: activeId ?? "", messageId });
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingMessageText("");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete message.");
    }
  }

  const activeGroupAdmin = Boolean(
    active?.isGroup &&
    active.members.some((member) => member.userId === session?.user?.id && member.role === "ADMIN"),
  );

  useEffect(() => {
    if (!showGroupInfo || !active?.isGroup || !session?.user) return;
    setGroupTitleDraft(active.title ?? "");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch("/api/users?q=" + encodeURIComponent(groupUserQuery) + "&take=8", { cache: "no-store" })
        .then(async (response) => {
          const json = await response.json().catch(() => ({}));
          if (!cancelled && response.ok) {
            const memberIds = new Set(active.members.map((member) => member.userId));
            setGroupPeople((json.users ?? []).filter((user: { id: string }) => !memberIds.has(user.id)));
          }
        })
        .catch(() => {});
    }, groupUserQuery.trim() ? 200 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [showGroupInfo, active?.id, active?.isGroup, active?.title, active?.members, session?.user?.id, groupUserQuery]);

  async function updateGroupTitle() {
    if (!activeId || !active?.isGroup || !activeGroupAdmin || !groupTitleDraft.trim() || groupActionLoading) return;
    setGroupActionLoading(true);
    try {
      const response = await fetch("/api/conversations/" + activeId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: groupTitleDraft.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not rename the group.");
      setConversations((current) => current.map((item) => item.id === activeId ? { ...item, title: json.conversation.title } : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not rename the group.");
    } finally {
      setGroupActionLoading(false);
    }
  }

  async function addGroupMember(userId: string) {
    if (!activeId || !activeGroupAdmin || groupActionLoading) return;
    setGroupActionLoading(true);
    try {
      const response = await fetch("/api/conversations/" + activeId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not add this member.");
      setConversations((current) => current.map((item) => item.id === activeId ? { ...item, members: [...item.members, json.membership] } : item));
      setGroupPeople((current) => current.filter((person) => person.id !== userId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add this member.");
    } finally {
      setGroupActionLoading(false);
    }
  }

  async function removeGroupMember(userId: string) {
    if (!activeId || !activeGroupAdmin || groupActionLoading) return;
    setGroupActionLoading(true);
    try {
      const response = await fetch("/api/conversations/" + activeId, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not remove this member.");
      setConversations((current) => current.map((item) => item.id === activeId ? { ...item, members: item.members.filter((member) => member.userId !== userId) } : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove this member.");
    } finally {
      setGroupActionLoading(false);
    }
  }

  async function leaveGroup() {
    if (!activeId || !active?.isGroup || groupActionLoading) return;
    if (!window.confirm("Leave this group?")) return;
    setGroupActionLoading(true);
    try {
      const response = await fetch("/api/conversations/" + activeId, { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not leave the group.");
      setConversations((current) => current.filter((item) => item.id !== activeId));
      setActiveId(null);
      setShowGroupInfo(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not leave the group.");
    } finally {
      setGroupActionLoading(false);
    }
  }

  async function updateConversationAction(action: "archive" | "unarchive" | "mute" | "unmute") {
    if (!activeId) return;
    const response = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) { setError(json.error ?? "Could not update conversation."); return; }
    setConversations((current) => current.map((item) => item.id === activeId ? { ...item, ...(action === "archive" || action === "unarchive" ? { archivedAt: json.archivedAt } : { mutedUntil: json.mutedUntil }) } : item));
    emitUnreadSummarySync();
    setShowConversationOptions(false);
    if (action === "archive") setActiveId(null);
  }

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 5 + 16;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || (!draft.trim() && !pendingAttachments.length) || !session?.user || sending) return;

    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), attachments: pendingAttachments, replyToId: replyingToMessage?.id ?? null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not send message.");
      setMessages((current) => [...current, json.message as ChatMessage]);
      setNewMessagesCount(0);
      emitLiveSync({ type: "message-created", conversationId: activeId, messageId: json.message?.id });
      emitUnreadSummarySync();
      window.requestAnimationFrame(() => {
        if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      });
      setDraft("");
      try { window.localStorage.removeItem("socialhub:draft:" + session.user.id + ":" + activeId); } catch {}
      void fetch("/api/conversations/" + activeId + "/typing", { method: "DELETE" }).catch(() => {});
      setPendingAttachments([]);
      setReplyingToMessage(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="messages-page min-w-0">
      {!session?.user ? (
        <div className="mb-5 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">
          Sign in to load your real conversations. The interface stays browsable while you are signed out.
        </div>
      ) : null}
      {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

      <div className="mb-4 flex items-start justify-between gap-3 lg:mb-5">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/home" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 lg:hidden" aria-label="Back to home">
            <ArrowLeft size={18}/>
          </Link>
          <div className="min-w-0">
            <p className="hidden text-xs font-black uppercase tracking-[.16em] text-[#6d5dfc] lg:block">Messages</p>
            <h1 className="page-heading mt-0 lg:text-[1.875rem]">Your conversations</h1>
            <p className="page-description mt-1 hidden max-w-2xl sm:block">Focused one-to-one and group messaging, designed to be easy to pick back up.</p>
          </div>
        </div>
      </div>

      {newConversationOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300 sm:hidden" aria-hidden="true"/>
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div><h2 className="text-base font-black">New message</h2><p className="mt-1 text-xs text-gray-500">Choose a real Socialhub account to start a chat.</p></div>
              <button type="button" onClick={() => setNewConversationOpen(false)} className="grid size-9 place-items-center rounded-xl bg-gray-100" aria-label="Close new message"><X size={16}/></button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto p-4">
              <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15}/><input autoFocus value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search people…" className="h-10 w-full rounded-xl bg-gray-50 pl-9 pr-3 text-xs font-semibold outline-none"/></label>
              <div className="mt-3 space-y-1">
                {people.filter((person) => person.id !== session?.user?.id && (person.isVerified || person.isOwner)).length ? people.filter((person) => person.id !== session?.user?.id && (person.isVerified || person.isOwner)).map((person)=>
                  <button type="button" key={person.id} onClick={() => void startConversation(person.id)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-gray-50">
                    <Avatar initials={person.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} image={person.image}/>
                    <span className="min-w-0"><span className="flex items-center gap-1 truncate text-xs font-black">{person.name}<AccountBadge verified={person.isVerified} owner={person.isOwner}/></span><span className="block truncate text-xs text-gray-500">@{person.username ?? "member"}</span></span>
                  </button>) :
                  <p className="p-6 text-center text-xs text-gray-500">{userQuery.trim() ? "No verified people found." : "Search for someone to message."}</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showGroupInfo && active?.isGroup ? (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Group information">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div><h2 className="text-base font-black">Group info</h2><p className="mt-1 text-xs text-gray-500">{active.members.length} members</p></div>
              <button type="button" onClick={() => setShowGroupInfo(false)} className="grid size-9 place-items-center rounded-xl bg-gray-100" aria-label="Close group info"><X size={16}/></button>
            </div>
            <div className="space-y-4 p-5">
              {activeGroupAdmin ? <div className="flex gap-2"><input value={groupTitleDraft} onChange={(event) => setGroupTitleDraft(event.target.value)} maxLength={100} className="h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold"/><button type="button" onClick={() => void updateGroupTitle()} disabled={groupActionLoading || !groupTitleDraft.trim()} className="rounded-xl bg-gray-950 px-4 text-xs font-black text-white disabled:opacity-40">Rename</button></div> : null}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs font-black uppercase tracking-[.12em] text-gray-500">Members</p><div className="mt-2 space-y-2">{active.members.map((member) => <div key={member.userId} className="flex items-center gap-3 rounded-xl bg-white p-2.5"><Avatar initials={member.user.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()} image={member.user.image} size="sm"/><div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate text-xs font-black">{member.user.name}<AccountBadge verified={member.user.isVerified} owner={member.user.isOwner}/></p><p className="text-xs text-gray-500">{member.role === "ADMIN" ? "Administrator" : "Member"}</p></div>{activeGroupAdmin && member.userId !== session?.user?.id && member.role !== "ADMIN" ? <button type="button" onClick={() => void removeGroupMember(member.userId)} disabled={groupActionLoading} className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-600 disabled:opacity-40">Remove</button> : null}</div>)}</div></div>
              {activeGroupAdmin ? <div><p className="text-xs font-black uppercase tracking-[.12em] text-gray-500">Add member</p><input value={groupUserQuery} onChange={(event) => setGroupUserQuery(event.target.value)} placeholder="Search people…" className="mt-2 h-10 w-full rounded-xl bg-gray-50 px-3 text-xs font-semibold outline-none"/><div className="mt-2 space-y-1">{groupPeople.slice(0,5).map((person) => <button type="button" key={person.id} onClick={() => void addGroupMember(person.id)} disabled={groupActionLoading} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-gray-50 disabled:opacity-50"><Avatar initials={person.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()} size="sm"/><span className="flex-1 truncate text-xs font-black">{person.name}</span><Plus size={15}/></button>)}</div></div> : null}
              <button type="button" onClick={() => void leaveGroup()} disabled={groupActionLoading} className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-black text-red-600 disabled:opacity-40">Leave group</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="messages-shell grid h-[calc(100dvh-var(--header-h)-var(--page-pad))] min-h-0 overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white shadow-[0_14px_40px_rgba(20,24,40,.06)] lg:grid-cols-[320px_1fr] lg:min-h-0">
        <aside className={(activeId ? "hidden lg:block " : "") + "min-h-0 overflow-y-auto border-b border-gray-100 pb-[calc(84px+env(safe-area-inset-bottom))] lg:border-b-0 lg:border-r lg:pb-2"}>
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2"><h2 className="text-sm font-black">{showArchivedConversations ? "Archived" : "Inbox"}</h2><button type="button" onClick={() => setShowArchivedConversations((value) => !value)} className="rounded-lg px-2 py-1 text-xs font-black text-gray-500 hover:bg-gray-100">{showArchivedConversations ? "Inbox" : "Archived"}</button></div>
            <button type="button" onClick={() => setNewConversationOpen(true)} className="social-icon-button" aria-label="Start a new message"><Pencil size={17}/></button>
          </div>
          <label className="relative m-3 block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16}/><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} className="h-10 w-full rounded-xl bg-gray-50 pl-10 text-xs font-semibold outline-none focus:bg-white" placeholder="Search messages" aria-label="Search messages"/></label>
          <div className="space-y-1 p-2">
            {loading && session?.user ? [1,2,3].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl p-3"><span className="size-10 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-2/3 animate-pulse rounded bg-gray-100"/></div></div>) : filteredConversations.length > 0 ? filteredConversations.map((conversation, i) => {
              const other = conversation.members.find((member) => member.userId !== session?.user?.id)?.user;
              const name = conversation.title ?? other?.name ?? "Conversation";
              const preview = conversation.messages[0]?.content ?? "No messages yet";
              return <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${conversation.id===activeId?"bg-[#f4f2ff]":"hover:bg-gray-50"}`}>
                <Avatar initials={(other?.name ?? name).split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} image={other?.image} color={colors[i%colors.length]}/>
                <div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate text-xs font-black">{name}<AccountBadge verified={other?.isVerified} owner={other?.isOwner}/></p><p className="mt-1 truncate text-xs text-gray-500">{preview}</p></div>
                {conversation.unreadCount ? <span className="min-w-5 rounded-full bg-[#6d5dfc] px-1.5 py-1 text-center text-[9px] font-black text-white">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span> : null}
              </button>;
            }) : <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-7 text-center"><MessageCircle className="mx-auto text-gray-300" size={22}/><p className="mt-3 text-xs font-black text-gray-700">{messageSearch.trim() ? "No matching conversations" : "No conversations yet"}</p><p className="mt-1 text-xs leading-5 text-gray-500">{messageSearch.trim() ? "Try another name or message." : session?.user ? "Your real conversations will appear here." : "Sign in to see your conversations."}</p></div>}
          </div>
        </aside>

        <MessagesErrorBoundary resetKey={activeId}>
          <section className={(activeId ? "flex fixed inset-0 z-[70] h-[var(--messages-vh,100dvh)] bg-white lg:static lg:z-auto lg:h-full " : "hidden lg:flex ") + "message-pane min-h-0 flex-col lg:min-h-0 lg:h-full"}>
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white p-3 sm:gap-3 sm:p-4">
              {active ? <button type="button" onClick={() => setActiveId(null)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-50 text-gray-600 lg:hidden" aria-label="Back to conversations"><ArrowLeft size={18}/></button> : null}
              <Avatar initials={(activeName || "MS").split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} image={activeMember?.image} />
              <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-sm font-black">{activeName}<AccountBadge verified={activeMember?.isVerified} owner={activeMember?.isOwner}/></p><p className="text-xs text-gray-500">{active ? (active.isGroup ? `${active.members.length} members` : "Direct message") : "Select a conversation"}</p></div>
              <div className="relative"><button type="button" onClick={() => setShowConversationOptions((value) => !value)} disabled={!active} className="social-icon-button disabled:opacity-40" aria-label="Conversation options"><MoreHorizontal size={18}/></button>
                {showConversationOptions && active ? <div className="absolute right-0 top-11 z-30 w-44 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl"><button type="button" onClick={() => void updateConversationAction(active.archivedAt ? "unarchive" : "archive")} className="flex w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-gray-50">{active.archivedAt ? "Unarchive" : "Archive"}</button><button type="button" onClick={() => void updateConversationAction(active.mutedUntil ? "unmute" : "mute")} className="flex w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-gray-50">{active.mutedUntil ? "Unmute" : "Mute for 7 days"}</button>{active.isGroup ? <button type="button" onClick={() => { setShowGroupInfo(true); setShowConversationOptions(false); }} className="flex w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-gray-50">Group info</button> : null}</div> : null}
              </div>
            </div>

            <div ref={messageListRef} className="message-list relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-5" style={{ scrollbarGutter: "stable" }}>
              {newMessagesCount > 0 ? <div className="sticky top-1 z-10 flex justify-center"><button type="button" onClick={() => { setNewMessagesCount(0); if (messageListRef.current) messageListRef.current.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" }); }} className="rounded-full border border-[#d9d4ff] bg-white/95 px-3 py-1.5 text-xs font-black text-[#5a4be8] shadow-md backdrop-blur">{newMessagesCount === 1 ? "1 new message" : newMessagesCount + " new messages"} · Jump to latest</button></div> : null}
              {nextMessagesCursor ? <div className="flex justify-center"><button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-600 shadow-sm disabled:opacity-50">{loadingOlderMessages ? "Loading older messages…" : "Load older messages"}</button></div> : null}
              {!active ? <div className="grid h-full place-items-center p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><MessageCircle size={24}/></span><h2 className="mt-4 text-base font-black">Choose a conversation</h2><p className="mt-1 max-w-xs text-sm text-gray-500">Select a conversation or start a new message.</p><button type="button" onClick={() => setNewConversationOpen(true)} className="mt-4 rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white">New message</button></div></div> : null}
              {active && messages.length > 0 ? messages.map((message) => {
                const mine = message.senderId === session?.user?.id;
                return <div key={message.id} className={mine ? "flex justify-end" : "flex items-end gap-2"}>{!mine ? <Avatar initials={message.sender.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()} image={message.sender.image} size="sm"/> : null}<div className="max-w-[82%] sm:max-w-[76%]">
                  {!mine ? <p className="mb-1 flex items-center gap-1 pl-1 text-xs font-black text-gray-500">{message.sender.name}<AccountBadge verified={message.sender.isVerified} owner={message.sender.isOwner}/></p> : null}
                  {editingMessageId === message.id ? <div className="rounded-2xl border border-[#cfc9ff] bg-white p-2 shadow-sm"><textarea value={editingMessageText} onChange={(event) => setEditingMessageText(event.target.value)} rows={2} maxLength={5000} className="w-full resize-none rounded-xl bg-gray-50 p-2 text-sm text-gray-800 outline-none" autoFocus/><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setEditingMessageId(null); setEditingMessageText(""); }} className="rounded-xl px-3 py-2 text-xs font-black text-gray-500">Cancel</button><button type="button" onClick={() => void editMessage(message.id)} disabled={!editingMessageText.trim() || savingMessage} className="rounded-xl bg-gray-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40">{savingMessage ? "Saving…" : "Save"}</button></div></div> : <div className={mine ? "rounded-2xl rounded-br-md bg-[#6d5dfc] px-4 py-3 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700"}>{message.attachments?.length && !message.deletedAt ? <div className="mb-2 grid gap-2">{message.attachments.map((attachment)=><img key={attachment.id} src={attachment.url} alt="Message attachment" className="max-h-72 w-full rounded-xl object-cover"/>)}</div> : null}{message.deletedAt ? <span className="italic opacity-70">Message deleted</span> : message.content ? <span>{message.content}</span> : null}</div>}
                  <div className={"mt-1 flex flex-wrap items-center gap-2 " + (mine ? "justify-end" : "")}><span className="text-[9px] text-gray-500">{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{mine && !active?.isGroup && active?.members.some((member) => member.userId !== session?.user?.id && member.lastReadAt && new Date(member.lastReadAt) >= new Date(message.createdAt)) ? <span className="text-[9px] font-bold text-[#5a4be8]">Seen</span> : null}{message.editedAt && !message.deletedAt ? <span className="text-[9px] text-gray-500">edited</span> : null}{message.reactions?.length ? <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs">{message.reactions.map((reaction)=>reaction.emoji).join("")}</span> : null}{message.replyTo && !message.deletedAt ? <div className="w-full max-w-xs rounded-xl border border-gray-200 bg-white/80 px-2.5 py-2 text-xs text-gray-500"><span className="font-black">Replying to {message.replyTo.sender.name}</span><p className="mt-0.5 truncate">{message.replyTo.content}</p></div> : null}{!message.deletedAt ? <button type="button" onClick={() => void reactToMessage(message.id)} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50" aria-label="React with heart">❤️</button> : null}{!message.deletedAt ? <button type="button" onClick={() => { setReplyingToMessage(message); setDraft(""); }} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50" aria-label="Reply to message"><MessageCircle size={11}/></button> : null}{mine && !message.deletedAt ? <><button type="button" onClick={() => { setEditingMessageId(message.id); setEditingMessageText(message.content); }} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-500 hover:bg-gray-50" aria-label="Edit message"><Pencil size={11}/></button><button type="button" onClick={() => void deleteMessage(message.id)} className="rounded-full border border-red-100 bg-white px-2 py-1 text-red-500 hover:bg-red-50" aria-label="Delete message"><Trash2 size={11}/></button></> : null}</div>
                </div></div>;
              }) : active ? <div className="flex h-full min-h-56 items-center justify-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><MessageCircle size={20}/></span><p className="mt-3 text-sm font-black">No messages yet</p><p className="mt-1 text-xs text-gray-500">Send the first message below.</p></div></div> : null}
            </div>

            {typingUsers.length ? <div className="shrink-0 px-5 pb-2 text-xs font-semibold text-gray-500" aria-live="polite"><span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5"><span className="flex gap-0.5" aria-hidden="true"><i className="size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-.3s]"/><i className="size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-.15s]"/><i className="size-1.5 animate-bounce rounded-full bg-gray-400"/></span>{typingUsers.length === 1 ? typingUsers[0].name + " is typing…" : typingUsers.slice(0, 2).map((user) => user.name).join(" and ") + " are typing…"}</span></div> : null}
            <form onSubmit={sendMessage} className="message-composer shrink-0 border-t border-gray-100 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
              {replyingToMessage ? <div className="mb-2 flex items-center justify-between rounded-xl bg-[#f4f2ff] px-3 py-2"><div className="min-w-0"><p className="text-xs font-black text-[#5a4be8]">Replying to {replyingToMessage.sender.name}</p><p className="truncate text-xs text-gray-500">{replyingToMessage.content || "Media message"}</p></div><button type="button" onClick={() => setReplyingToMessage(null)} className="grid size-7 place-items-center rounded-lg bg-white text-gray-500" aria-label="Cancel reply"><X size={13}/></button></div> : null}
              <input ref={attachmentRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => { void uploadAttachments(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
              {pendingAttachments.length ? <div className="mb-2 flex gap-2 overflow-x-auto">{pendingAttachments.map((url, index)=><div key={url} className="relative shrink-0"><img src={url} alt="Pending attachment" className="size-16 rounded-xl object-cover"/><button type="button" onClick={() => setPendingAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-gray-950 text-white" aria-label="Remove attachment"><X size={11}/></button></div>)}</div> : null}
              <div className="flex items-end gap-2 rounded-2xl bg-gray-50 p-2">
                <button type="button" onClick={() => attachmentRef.current?.click()} disabled={!active || uploadingAttachment || pendingAttachments.length >= 4} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-gray-500 disabled:opacity-40" aria-label="Attach image"><Paperclip size={16}/></button>
                <textarea ref={composerRef} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(min-width: 1024px)").matches) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} disabled={!active || !session?.user || sending} className="min-h-10 max-h-[136px] flex-1 resize-none overflow-hidden bg-transparent px-2 py-2 text-sm leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder={active ? "Write a message…" : "Select a conversation first"} aria-label="Write a message"/>
                <button type="submit" disabled={!active || (!draft.trim() && !pendingAttachments.length) || !session?.user || sending} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6d5dfc] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={16}/></button>
              </div>
            </form>
          </section>
        </MessagesErrorBoundary>
      </div>
    </div>
  );
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
  friendRequestStatus?: "NONE" | "OUTGOING_PENDING" | "INCOMING_PENDING";
  canFollow?: boolean;
  canSendFriendRequest?: boolean;
  isVerified?: boolean;
  isOwner?: boolean;
  displayCounts?: { followers: number; following?: number; posts?: number };
  _count: { followers: number; following: number };
};

function Discover({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<Array<{ id: string; content: string | null; createdAt: string; author: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean }; displayCounts?: { likes: number; comments: number; shares: number }; _count: { likes: number; comments: number } }>>([]);
  const [discoverHashtags, setDiscoverHashtags] = useState<Array<{ tag: string; count: number }>>([]);
  const [discoverTab, setDiscoverTab] = useState<"people" | "posts" | "hashtags">("people");
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [trends, setTrends] = useState<Array<{ tag: string; posts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQ(initialQuery);
    setDiscoverTab(initialQuery.trim().startsWith("#") ? "posts" : "people");
  }, [initialQuery]);

  useEffect(() => {
    const urlQuery = new URLSearchParams(window.location.search).get("q") ?? "";
    if (urlQuery !== q) {
      router.replace(q.trim() ? "/discover?q=" + encodeURIComponent(q.trim()) : "/discover", { scroll: false });
    }
  }, [q, router]);

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
    const controller = new AbortController();

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const endpoint = q.trim()
          ? "/api/search?q=" + encodeURIComponent(q) + "&take=20"
          : "/api/users?suggestions=true&take=20";
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not search.");
        if (!cancelled) {
          const nextResults = (json.users ?? []) as DiscoverUser[];
          setResults(nextResults);
          setDiscoverPosts(q.trim() ? (json.posts ?? []) : []);
          setDiscoverHashtags(q.trim() ? (json.hashtags ?? []) : []);
          setFollowing(new Set(nextResults.filter((user) => user.isFollowing).map((user) => user.id)));
        }
      } catch (requestError) {
        if (!cancelled && !(requestError instanceof DOMException && requestError.name === "AbortError")) setError(requestError instanceof Error ? requestError.message : "Could not search users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(() => {
      void loadUsers();
    }, q ? 250 : 0);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q]);

  async function toggleFollow(user: DiscoverUser) {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    if (user.isPrivate && user.canSendFriendRequest && user.friendRequestStatus === "NONE") {
      const friendResponse = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: user.id }),
      });
      if (!friendResponse.ok) {
        const json = await friendResponse.json().catch(() => ({}));
        setError(json.error ?? "Could not send friend request.");
      } else {
        setResults((current) => current.map((row) =>
          row.id === user.id
            ? { ...row, friendRequestStatus: "OUTGOING_PENDING", canSendFriendRequest: false, canFollow: false }
            : row,
        ));
      }
      return;
    }

    const isFollowing = following.has(user.id);
    if (!isFollowing && user.canFollow === false) return;
    const response = await fetch("/api/users/" + user.id + "/follow", {
      method: isFollowing ? "DELETE" : "POST",
    });

    if (response.ok) {
      const nextFollowing = !isFollowing;
      emitLiveSync({ type: "follow-updated", userId: user.id, following: nextFollowing });
      setFollowing((current) => {
        const next = new Set(current);
        if (isFollowing) next.delete(user.id);
        else next.add(user.id);
        return next;
      });
    } else {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not update this connection.");
    }
  }

  return <Page wide eyebrow="Discover" title="Find your next connection" subtitle="Search people, browse topics, and explore conversations worth joining.">
    <div className="space-y-5">
      <Card>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18}/>
          <input value={q} onChange={(e)=>{ const value = e.target.value; setQ(value); if (value.trim().startsWith("#")) setDiscoverTab("posts"); else setDiscoverTab("people"); }} className="h-12 w-full rounded-2xl bg-gray-50 pl-11 text-sm font-semibold outline-none focus:bg-white" placeholder="Search people and usernames…"/>
        </div>
        <div className="mt-4 overflow-hidden">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {([["people","People"],["posts","Posts"],["hashtags","Hashtags"]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setDiscoverTab(value)} className={"rounded-xl px-3.5 py-2 text-xs font-black " + (discoverTab === value ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-50 text-gray-500")}>{label}</button>)}
          </div>
        </div>
      </Card>

      {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

      <div className="grid gap-5 md:grid-cols-2">
        {discoverTab === "people" ? <Card>
          <div className="flex justify-between"><h2 className="text-sm font-black">{q ? "People results" : "Suggested people"}</h2><span className="text-xs font-bold text-gray-500">{results.length} people</span></div>
          <div className="mt-4 space-y-4">{loading ? [1,2,3].map((item)=><div key={item} className="flex items-center gap-3 p-2"><span className="size-10 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/2 animate-pulse rounded bg-gray-100"/></div></div>) :
          results.map((user, i) => {
            const initials = user.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase();
            const isFollowing = following.has(user.id);
            return <div key={user.id} className="flex items-center gap-3">
              <Link href={"/profile/" + (user.username ?? user.id)}><Avatar initials={initials} image={user.image} color={colors[i % colors.length]}/></Link>
              <div className="min-w-0 flex-1"><Link href={"/profile/" + (user.username ?? user.id)} className="flex items-center gap-1.5 truncate text-xs font-black hover:text-[#5a4be8]">{user.name}<AccountBadge verified={user.isVerified} owner={user.isOwner}/></Link><p className="truncate text-xs text-gray-500">@{user.username ?? "member"} · <span title={fullCount(user.displayCounts?.followers ?? user._count.followers) + " followers"}>{compactCount(user.displayCounts?.followers ?? user._count.followers)} followers</span></p></div>
              <button onClick={()=>void toggleFollow(user)} disabled={user.friendRequestStatus === "OUTGOING_PENDING" || user.friendRequestStatus === "INCOMING_PENDING"} className={isFollowing ? "grid size-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-50" : "grid size-9 place-items-center rounded-xl bg-gray-950 text-white disabled:opacity-50"} aria-label={isFollowing ? "Unfollow" : user.friendRequestStatus === "OUTGOING_PENDING" ? "Friend request sent" : user.isPrivate ? "Add friend" : "Follow"}>{isFollowing ? <Check size={15}/> : user.friendRequestStatus === "OUTGOING_PENDING" ? <Check size={15}/> : user.isPrivate ? <UserPlus size={15}/> : <UserPlus size={15}/>}</button>
            </div>;
          })}</div>
        </Card> : discoverTab === "posts" ? <Card>
          <div className="flex justify-between"><h2 className="text-sm font-black">Post results</h2><span className="text-xs font-bold text-gray-500">{discoverPosts.length} posts</span></div>
          <div className="mt-4 space-y-3">{discoverPosts.length ? discoverPosts.map((post) => <Link key={post.id} href={"/home#post-" + encodeURIComponent(post.id)} className="block rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white"><div className="flex items-center gap-3"><Avatar initials={post.author.name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()}/><div><p className="flex items-center gap-1.5 text-xs font-black">{post.author.name}<AccountBadge verified={post.author.isVerified} owner={post.author.isOwner}/></p><p className="text-xs text-gray-500">@{post.author.username ?? "member"} · {formatSocialDateTime(post.createdAt)}</p></div></div><PostContent content={post.content ?? "Media post"} className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600"/><p className="mt-2 text-xs text-gray-500"><span title={fullCount(post.displayCounts?.likes ?? post._count.likes) + " likes"}>{compactCount(post.displayCounts?.likes ?? post._count.likes)} likes</span> · <span title={fullCount(post.displayCounts?.comments ?? post._count.comments) + " comments"}>{compactCount(post.displayCounts?.comments ?? post._count.comments)} comments</span></p></Link>) : <p className="py-8 text-center text-xs text-gray-500">No matching posts found.</p>}</div>
        </Card> : <Card>
          <div className="flex justify-between"><h2 className="text-sm font-black">Hashtags</h2><span className="text-xs font-bold text-gray-500">{discoverHashtags.length} tags</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{discoverHashtags.length ? discoverHashtags.map((item) => <Link key={item.tag} href={"/discover?q=" + encodeURIComponent(item.tag)} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:bg-white"><span className="block text-sm font-black text-[#5a4be8]">{item.tag}</span><span className="mt-1 block text-xs text-gray-500">{item.count} matching posts in the current result set</span></Link>) : <p className="py-8 text-center text-xs text-gray-500">No matching hashtags found.</p>}</div>
        </Card>}

        <Card>
          <h2 className="text-sm font-black">Trending hashtags</h2>
          <div className="mt-4 space-y-2">
            {trends.length ? trends.map((trend, i) => <Link key={trend.tag} href={"/discover?q=" + encodeURIComponent(trend.tag)} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-gray-50">
              <span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-xs font-black text-gray-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1"><span className="block text-xs font-black">{trend.tag}</span><span className="text-xs text-gray-500">{trend.posts} {trend.posts === 1 ? "post" : "posts"}</span></span>
              <ChevronRight size={16} className="text-gray-500"/>
            </Link>) : <p className="py-4 text-xs text-gray-500">No hashtags are trending yet. Start a conversation with a hashtag.</p>}
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
  isVerified?: boolean;
  isOwner?: boolean;
  isFollowing?: boolean;
  isFriend?: boolean;
  friendRequestStatus?: "NONE" | "OUTGOING_PENDING" | "INCOMING_PENDING";
  displayCounts?: { followers: number; following?: number; posts?: number };
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

  const loadFriends = useCallback(async (silent = false) => {
    if (!session?.user) {
      setReceived([]);
      setSent([]);
      setSuggestions([]);
      setFriends([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError("");
    try {
      const [requestResponse, friendResponse, userResponse] = await Promise.all([
        fetch("/api/friend-requests", { cache: "no-store" }),
        fetch("/api/friends", { cache: "no-store" }),
        fetch("/api/users?take=12&suggestions=true", { cache: "no-store" }),
      ]);
      const requestJson = await requestResponse.json();
      const friendJson = await friendResponse.json();
      const userJson = await userResponse.json();
      if (!requestResponse.ok) throw new Error(requestJson.error ?? "Could not load friend requests.");
      if (!friendResponse.ok) throw new Error(friendJson.error ?? "Could not load friends.");
      if (!userResponse.ok) throw new Error(userJson.error ?? "Could not load suggestions.");

      const nextSuggestions = (userJson.users ?? []).filter((user: FriendPerson) =>
        user.id !== session.user.id &&
        !user.isFriend &&
        !user.isFollowing &&
        (user.friendRequestStatus ?? "NONE") === "NONE",
      );
      setReceived(requestJson.received ?? []);
      setSent(requestJson.sent ?? []);
      setFriends((friendJson.friends ?? []) as FriendPerson[]);
      setSuggestions(nextSuggestions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load friends.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { void loadFriends(); }, [loadFriends]);
  useLivePoll(() => loadFriends(true), 7000, Boolean(session?.user));

  useEffect(() => {
    return subscribeLiveSync((event) => {
      if (event.type === "friend-request-changed") void loadFriends(true);
    });
  }, [loadFriends]);

  async function cancelRequest(requestId: string) {
    const response = await fetch("/api/friend-requests/" + requestId, { method: "DELETE" });
    if (response.ok) {
      setSent((items) => items.filter((item) => item.id !== requestId));
      emitLiveSync({ type: "friend-request-changed" });
      emitUnreadSummarySync();
    } else {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not cancel friend request.");
    }
  }

  async function removeFriend(friendId: string) {
    if (!window.confirm("Remove this friend?")) return;
    const response = await fetch("/api/friends/" + friendId, { method: "DELETE" });
    if (response.ok) {
      setFriends((items) => items.filter((item) => item.id !== friendId));
      emitLiveSync({ type: "friend-request-changed" });
    } else {
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
      emitLiveSync({ type: "friend-request-changed" });
      emitUnreadSummarySync();
    } else {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Could not update friend request.");
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
    emitLiveSync({ type: "friend-request-changed" });
    emitUnreadSummarySync();
  }

  const initials = (name: string) => name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase();
  const requestCount = received.length;
  const displayPeople = tab === "requests"
    ? received.map((item) => item.sender)
    : tab === "sent"
      ? sent.map((item) => item.receiver!).filter(Boolean)
      : tab === "suggestions"
        ? suggestions
        : friends;

  return <Page eyebrow="Friends" title="Manage your circle" subtitle="Review requests, discover people you know, and keep your connections organized.">
    {!session?.user ? (
      <div className="mb-5 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">Sign in to manage your real friendships.</div>
    ) : null}
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}

    <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5">
      {[["requests","Requests",String(requestCount)],["sent","Sent",String(sent.length)],["suggestions","Suggestions",String(suggestions.length)],["all","All friends",String(friends.length)]].map((item)=>
        <button key={item[0]} onClick={()=>setTab(item[0])} className={"flex min-h-10 shrink-0 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-black " + (tab===item[0] ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500")}>
          {item[1]} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px]">{item[2]}</span>
        </button>
      )}
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {loading && session?.user ? [1,2,3,4].map((item)=><Card key={item} className="flex items-center gap-4"><span className="size-14 animate-pulse rounded-full bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/2 animate-pulse rounded bg-gray-100"/></div></Card>) :
      displayPeople.map((person, i) => {
        const request = tab === "requests" ? received[i] : tab === "sent" ? sent[i] : null;
        return <Card key={person.id} className="flex items-center gap-4">
          <Link href={"/profile/" + (person.username ?? person.id)}><Avatar initials={initials(person.name)} image={person.image} color={colors[i % colors.length]} size="lg"/></Link>
          <div className="min-w-0 flex-1">
            <Link href={"/profile/" + (person.username ?? person.id)} className="flex items-center gap-1 truncate text-sm font-black hover:text-[#5a4be8]">{person.name}<AccountBadge verified={person.isVerified} owner={person.isOwner}/></Link>
            <p className="text-xs text-gray-500">@{person.username ?? "member"}</p>
            <p className="mt-2 truncate text-xs text-gray-500">{person.bio ?? "Socialhub member"}</p>
          </div>
          {tab === "requests" && request ? (
            <div className="flex shrink-0 gap-2">
              <button onClick={()=>void respond(request.id, "ACCEPTED")} className="grid size-9 place-items-center rounded-xl bg-[#6d5dfc] text-white" aria-label="Accept request"><Check size={15}/></button>
              <button onClick={()=>void respond(request.id, "DECLINED")} className="grid size-9 place-items-center rounded-xl bg-gray-100 text-gray-600" aria-label="Decline request"><X size={15}/></button>
            </div>
          ) : tab === "sent" && request ? (
            <button onClick={()=>void cancelRequest(request.id)} className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600" aria-label="Cancel friend request">Cancel</button>
          ) : tab === "suggestions" ? (
            <button onClick={()=>void sendRequest(person.id)} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gray-950 px-3 text-xs font-black text-white" aria-label={"Add " + person.name + " as a friend"}><UserPlus size={14}/> Add friend</button>
          ) : tab === "all" ? (
            <button onClick={()=>void removeFriend(person.id)} className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50" aria-label={"Remove " + person.name}>Remove</button>
          ) : null}
        </Card>;
      })}

      {!loading && displayPeople.length === 0 ? (
        <div className="sm:col-span-2 rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Users size={20}/></span>
          <p className="mt-3 text-sm font-black">{tab === "requests" ? "No pending requests" : tab === "sent" ? "No sent requests" : tab === "suggestions" ? "No new suggestions" : "No friends yet"}</p>
          <p className="mt-1 text-xs text-gray-500">{tab === "suggestions" ? "Everyone shown here is currently available to add." : "Your next connection will appear here."}</p>
        </div>
      ) : null}
    </div>
  </Page>;
}
type NotificationData = {
  id: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "MESSAGE" | "MENTION" | "SHARE" | "SYSTEM" | "STORY_REPLY" | "STORY_REACTION";
  readAt: string | null;
  createdAt: string;
  title?: string | null;
  body?: string | null;
  actor: { id: string; name: string; username: string | null; image: string | null; isVerified?: boolean; isOwner?: boolean } | null;
  post?: { id: string; content: string | null; mediaUrl: string | null } | null;
  comment?: { id: string; content: string } | null;
  message?: { id: string; conversationId: string } | null;
  story?: { id: string } | null;
};

function Notifications() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [nextNotificationCursor, setNextNotificationCursor] = useState<string | null>(null);
  const [loadingOlderNotifications, setLoadingOlderNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const notificationFirstLoadRef = useRef(true);

  const refreshNotifications = useCallback(async () => {
    if (!session?.user) {
      setNotifications([]);
      setNextNotificationCursor(null);
      notificationFirstLoadRef.current = true;
      setLoading(false);
      return;
    }

    const isInitialLoad = notificationFirstLoadRef.current;
    if (isInitialLoad) setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load notifications.");
      const fresh = (json.notifications ?? []) as NotificationData[];
      setNotifications((current) => {
        const freshIds = new Set(fresh.map((item) => item.id));
        return [...fresh, ...current.filter((item) => !freshIds.has(item.id))];
      });
      if (isInitialLoad) setNextNotificationCursor(json.nextBefore ?? null);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load notifications.");
    } finally {
      notificationFirstLoadRef.current = false;
      setLoading(false);
    }
  }, [session?.user?.id]);

  useLivePoll(refreshNotifications, 6500, Boolean(session?.user));

  useEffect(() => {
    return subscribeLiveSync((event) => {
      if (
        event.type === "notification-created" ||
        event.type === "friend-request-changed" ||
        event.type === "read-state-changed"
      ) {
        void refreshNotifications();
      }
    });
  }, [refreshNotifications]);

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
    if (response.ok) {
      setNotifications((items) => items.map((item) => ({ ...item, readAt: new Date().toISOString() })));
      emitUnreadSummarySync();
    }
  }

  async function openNotification(item: NotificationData) {
    if (!session?.user) return;
    if (!item.readAt) {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      });
      if (response.ok) {
        setNotifications((items) => items.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row));
        emitUnreadSummarySync();
      }
    }

    if (item.type === "FOLLOW" && item.actor?.username) {
      router.push("/profile/" + encodeURIComponent(item.actor.username));
    } else if (item.type === "FRIEND_REQUEST" || item.type === "FRIEND_ACCEPTED") {
      router.push("/friends");
    } else if (item.type === "MESSAGE" && item.message?.conversationId) {
      router.push("/messages?conversation=" + encodeURIComponent(item.message.conversationId));
    } else if ((item.type === "STORY_REPLY" || item.type === "STORY_REACTION") && item.story?.id) {
      router.push("/home?story=" + encodeURIComponent(item.story.id));
    } else if (item.post?.id) {
      router.push("/home#post-" + encodeURIComponent(item.post.id));
    } else {
      router.push("/home");
    }
  }

  function iconFor(type: NotificationData["type"]) {
    if (type === "LIKE" || type === "STORY_REACTION") return Heart;
    if (type === "COMMENT" || type === "MESSAGE" || type === "STORY_REPLY") return MessageCircle;
    if (type === "FOLLOW") return UserPlus;
    if (type === "FRIEND_REQUEST" || type === "FRIEND_ACCEPTED") return Users;
    if (type === "MENTION") return AtSign;
    if (type === "SHARE") return Send;
    return Bell;
  }

  function styleFor(type: NotificationData["type"]) {
    if (type === "LIKE" || type === "STORY_REACTION") return "bg-rose-50 text-rose-500";
    if (type === "FOLLOW" || type === "FRIEND_ACCEPTED") return "bg-violet-50 text-violet-600";
    if (type === "COMMENT" || type === "MESSAGE" || type === "STORY_REPLY" || type === "MENTION") return "bg-sky-50 text-sky-500";
    if (type === "FRIEND_REQUEST") return "bg-emerald-50 text-emerald-600";
    return "bg-amber-50 text-amber-500";
  }
  type NotificationFilter = "ALL" | "UNREAD" | "SOCIAL" | "MESSAGES" | "REQUESTS";
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("ALL");
  const filteredNotifications = notifications.filter((item) => {
    if (notificationFilter === "UNREAD") return !item.readAt;
    if (notificationFilter === "SOCIAL") return ["LIKE","COMMENT","FOLLOW","MENTION","SHARE","STORY_REPLY","STORY_REACTION"].includes(item.type);
    if (notificationFilter === "MESSAGES") return item.type === "MESSAGE";
    if (notificationFilter === "REQUESTS") return item.type === "FRIEND_REQUEST" || item.type === "FRIEND_ACCEPTED";
    return true;
  });

  return <Page eyebrow="Notifications" title="Stay in the loop" subtitle="Important activity stays here so you can catch up without hunting through your feed.">
    {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error}</div> : null}
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black">Recent activity</h2><button onClick={markAllRead} disabled={!session?.user} className="text-xs font-bold text-[#5a4be8] disabled:opacity-40">Mark all as read</button></div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {([["ALL","All"],["UNREAD","Unread"],["SOCIAL","Social"],["MESSAGES","Messages"],["REQUESTS","Requests"]] as Array<[NotificationFilter,string]>).map(([value,label]) => (
            <button key={value} type="button" onClick={() => setNotificationFilter(value)} className={"shrink-0 rounded-full px-3 py-1.5 text-xs font-black " + (notificationFilter === value ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-50 text-gray-500 hover:bg-gray-100")}>{label}</button>
          ))}
        </div>
      </div>
      {loading && session?.user ? <div className="space-y-2 p-5">{[1,2,3].map((i)=><div key={i} className="flex gap-3 p-3"><span className="size-10 animate-pulse rounded-2xl bg-gray-100"/><div className="flex-1 space-y-2"><span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100"/><span className="block h-2.5 w-1/3 animate-pulse rounded bg-gray-100"/></div></div>)}</div> : null}
      {filteredNotifications.length > 0 ? <>
        {filteredNotifications.map((item) => {
        const Icon = iconFor(item.type);
        return <button key={item.id} onClick={() => void openNotification(item)} className={`flex w-full gap-3 border-b border-gray-100 p-5 text-left last:border-0 hover:bg-gray-50 ${item.readAt ? "" : "bg-[#fbfaff]"}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${styleFor(item.type)}`}><Icon size={17}/></span>
          <span className="flex-1"><span className="block text-sm font-bold">{item.type === "SYSTEM" ? (item.title ?? "Account update") : <>{item.actor?.name ?? "Socialhub"} <AccountBadge verified={item.actor?.isVerified} owner={item.actor?.isOwner}/>{item.type === "LIKE" ? " liked your post." : item.type === "FOLLOW" ? " started following you." : item.type === "COMMENT" ? " commented on your post." : item.type === "FRIEND_REQUEST" ? " sent you a friend request." : item.type === "FRIEND_ACCEPTED" ? " accepted your friend request." : item.type === "MESSAGE" ? " sent you a message." : item.type === "STORY_REPLY" ? " replied to your story." : item.type === "STORY_REACTION" ? " reacted to your story." : item.type === "MENTION" ? " mentioned you." : " interacted with your content."}</>}</span><span className="mt-1 block text-xs text-gray-500">{item.type === "SYSTEM" && item.body ? item.body + " · " : ""}{formatSocialDateTime(item.createdAt)}</span></span>
          {!item.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-[#6d5dfc]"/> : null}
        </button>;
        })}
        {nextNotificationCursor ? <div className="border-t border-gray-100 p-4 text-center"><button type="button" onClick={() => void loadOlderNotifications()} disabled={loadingOlderNotifications} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-600 disabled:opacity-50">{loadingOlderNotifications ? "Loading older notifications…" : "Load older notifications"}</button></div> : null}
      </> : !loading ? (
        session?.user ? (
          <div className="p-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Bell size={20}/></span>
            <p className="mt-3 text-sm font-black">You’re all caught up.</p>
            <p className="mt-1 text-xs text-gray-500">New likes, follows, comments, and requests will appear here.</p>
          </div>
        ) : (
          <div className="p-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gray-100 text-gray-500"><Bell size={20}/></span>
            <p className="mt-3 text-sm font-black">Sign in to see your notifications</p>
            <p className="mt-1 text-xs text-gray-500">Your real likes, follows, comments, messages, and requests will appear here.</p>
          </div>
        )
      ) : null}

    </Card>
  </Page>;
}

function formatSessionDevice(userAgent: string | null) {
  const ua = userAgent ?? "";
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Chrome/") ? "Chrome" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Safari/") && !ua.includes("Chrome/") ? "Safari" : ua.includes("OPR/") ? "Opera" : "Browser";
  const os = /Windows NT/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Device";
  return browser + " on " + os;
}

function SettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [privateAccount, setPrivate] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({ showFriendsList: true, showFollowersList: true, showFollowingList: true, allowMessagesEveryone: true, allowFriendRequests: true });
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
  const [verification, setVerification] = useState<{ isVerified: boolean; isOwner: boolean; status: "PENDING"|"APPROVED"|"REJECTED"|"CANCELLED"|null; reason?: string|null; adminNote?: string|null; createdAt?: string|null }>({ isVerified: false, isOwner: false, status: null });
  const [verificationReason, setVerificationReason] = useState("");
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", username: "", bio: "", location: "", website: "" });
  const [savingAccount, setSavingAccount] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailStep, setEmailStep] = useState<"idle" | "current" | "new">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [currentEmailOtp, setCurrentEmailOtp] = useState("");
  const [newEmailOtp, setNewEmailOtp] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState("general");

  useEffect(() => {
    const ids = ["general", "privacy", "notifications", "security", "help"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSettingsSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.6] },
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

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
          setAccountForm({
            name: json.profile.name ?? "",
            username: json.profile.username ?? "",
            bio: json.profile.bio ?? "",
            location: json.profile.location ?? "",
            website: json.profile.website ?? "",
          });
          setVerification((current) => ({ ...current, isVerified: Boolean(json.profile.isVerified), isOwner: Boolean(json.profile.isOwner) }));
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

  useEffect(() => {
    if (!emailCooldown) return;
    const timer = window.setInterval(() => setEmailCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/verification", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Could not load verification status.");
        setVerification({
          isVerified: Boolean(json.user?.isVerified),
          isOwner: Boolean(json.user?.isOwner),
          status: json.request?.status ?? null,
          reason: json.request?.reason ?? null,
          adminNote: json.request?.adminNote ?? null,
          createdAt: json.request?.createdAt ?? null,
        });
      })
      .catch((requestError) => setMessage(requestError instanceof Error ? requestError.message : "Could not load verification status."));
  }, [session?.user?.id]);

  async function submitVerificationRequest() {
    if (!session?.user || verificationSubmitting) return;
    setVerificationSubmitting(true);
    try {
      const response = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: verificationReason.trim() }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not submit verification request.");
      setVerification((current) => ({ ...current, status: json.request?.status ?? "PENDING", reason: json.request?.reason ?? verificationReason.trim(), createdAt: json.request?.createdAt ?? new Date().toISOString() }));
      setVerificationReason("");
      setMessage("Verification request submitted for admin review.");
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Could not submit verification request.");
    } finally {
      setVerificationSubmitting(false);
    }
  }
  async function updatePrivacySetting(key: "showFriendsList" | "showFollowersList" | "showFollowingList" | "allowMessagesEveryone" | "allowFriendRequests", value: boolean) {
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

  async function saveAccountProfile() {
    if (!session?.user || savingAccount) return;
    setSavingAccount(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountForm.name.trim(),
          username: accountForm.username.trim() || null,
          bio: accountForm.bio.trim() || null,
          location: accountForm.location.trim() || null,
          website: accountForm.website.trim() || null,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not update your profile.");
      setAccountForm({
        name: json.profile?.name ?? accountForm.name,
        username: json.profile?.username ?? "",
        bio: json.profile?.bio ?? "",
        location: json.profile?.location ?? "",
        website: json.profile?.website ?? "",
      });
      setUsername(json.profile?.username ? "@" + json.profile.username : "No username");
      setEditingProfile(false);
      setMessage("Profile information saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function sendCurrentEmailOtp() {
    if (!session?.user || emailBusy || emailCooldown) return;
    setEmailBusy(true);
    setMessage("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) throw new Error(result.error.message || "Could not send the verification code.");
      setEmailStep("current");
      setCurrentEmailOtp("");
      setNewEmailOtp("");
      setEmailCooldown(30);
      setMessage("A verification code was sent to your current email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the verification code.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function sendNewEmailOtp() {
    const target = newEmail.trim().toLowerCase();
    if (!session?.user || emailBusy || currentEmailOtp.length !== 6 || !target) return;
    if (target === email.toLowerCase()) {
      setMessage("Enter a different email address.");
      return;
    }
    setEmailBusy(true);
    setMessage("");
    try {
      const result = await authClient.emailOtp.requestEmailChange({ newEmail: target, otp: currentEmailOtp.trim() });
      if (result.error) throw new Error(result.error.message || "Could not start the email change.");
      setEmailStep("new");
      setNewEmailOtp("");
      setEmailCooldown(30);
      setMessage("A verification code was sent to your new email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the email change.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmNewEmail() {
    const target = newEmail.trim().toLowerCase();
    if (!session?.user || emailBusy || newEmailOtp.length !== 6 || !target) return;
    setEmailBusy(true);
    setMessage("");
    try {
      const result = await authClient.emailOtp.changeEmail({ newEmail: target, otp: newEmailOtp.trim() });
      if (result.error) throw new Error(result.error.message || "Could not update your email.");
      setEmail(target);
      setChangingEmail(false);
      setEmailStep("idle");
      setNewEmail("");
      setCurrentEmailOtp("");
      setNewEmailOtp("");
      setEmailCooldown(0);
      setMessage("Email address updated successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword() {
    if (!session?.user || passwordBusy) return;
    if (newPassword.length < 8) {
      setMessage("Use at least 8 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setMessage("");
    try {
      const result = await authClient.changePassword({ newPassword, currentPassword, revokeOtherSessions });
      if (result.error) throw new Error(result.error.message || "Could not change the password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
      setMessage(revokeOtherSessions ? "Password changed and other sessions were signed out." : "Password changed successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change the password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return <Page wide eyebrow="Settings" title="Make Socialhub yours" subtitle="Control account, privacy, notifications, and security from one place.">
    {!session?.user ? (
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-[#d9d4ff] bg-[#f8f7ff] px-4 py-3 text-xs font-semibold text-[#5a4be8]">
        <span>Sign in to save account settings.</span>
        <Link href="/login" className="font-black underline">Sign in</Link>
      </div>
    ) : null}
    {message ? <div role="status" className="mb-5 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-semibold text-gray-600">{message}</div> : null}

    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card id="settings-navigation" className="h-fit !p-3 lg:sticky lg:top-24">
        <p className="sr-only">Settings areas</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:flex-col lg:overflow-visible lg:pb-0">
          {[
            ["general", "General"],
            ["privacy", "Privacy"],
            ["notifications", "Notifications"],
            ["security", "Security"],
            ["help", "Help"],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} className={"flex min-h-10 w-full items-center rounded-xl px-3 text-left text-xs font-black transition " + (activeSettingsSection === id ? "bg-[#eeebff] text-[#5a4be8]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900")}>{label}</button>
          ))}
        </div>
      </Card>

      <div className="space-y-5">
        <Card id="general" className={activeSettingsSection === "general" ? "block" : "hidden lg:block"}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#6d5dfc]">General</p><h2 className="mt-1 text-xl font-black">Account</h2><p className="mt-2 text-xs text-gray-500">Edit the personal information shown across Socialhub.</p></div>
            <button type="button" onClick={() => setEditingProfile((value) => !value)} disabled={!session?.user || loading} className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Pencil size={14} className="mr-1 inline"/>{editingProfile ? "Close editor" : "Edit profile"}</button>
          </div>
          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
            <ThemeToggle variant="setting" />
          </div>
          {!editingProfile ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[["Display name",accountForm.name,Users],["Username",accountForm.username ? "@" + accountForm.username : "Not set",AtSign],["Bio",accountForm.bio || "No bio yet",MessageCircle],["Location",accountForm.location || "Not set",Compass],["Website",accountForm.website || "Not set",Globe2],["Email",email,Mail]].map(([title,detail,Icon]) => <div key={String(title)} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3"><span className="grid size-9 place-items-center rounded-xl bg-white text-gray-500"><Icon size={15}/></span><span className="min-w-0"><span className="block text-xs font-black uppercase tracking-[.08em] text-gray-500">{String(title)}</span><span className="mt-1 block break-words text-xs font-bold text-gray-700">{String(detail)}</span></span></div>)}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 rounded-2xl border border-[#ddd8ff] bg-[#f8f7ff] p-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-black text-gray-700">Display name</span><input value={accountForm.name} onChange={(event) => setAccountForm((value) => ({...value,name:event.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black text-gray-700">Username</span><input value={accountForm.username} onChange={(event) => setAccountForm((value) => ({...value,username:event.target.value.replace(/^@/,"")}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
              <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-gray-700">Bio</span><textarea value={accountForm.bio} maxLength={500} onChange={(event) => setAccountForm((value) => ({...value,bio:event.target.value}))} rows={4} className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm"/></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black text-gray-700">Location</span><input value={accountForm.location} onChange={(event) => setAccountForm((value) => ({...value,location:event.target.value}))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black text-gray-700">Website</span><input type="url" value={accountForm.website} onChange={(event) => setAccountForm((value) => ({...value,website:event.target.value}))} placeholder="https://example.com" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"/></label>
              <div className="flex gap-2 sm:col-span-2 sm:justify-end"><button type="button" onClick={() => setEditingProfile(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-600">Cancel</button><button type="button" onClick={() => void saveAccountProfile()} disabled={savingAccount || !accountForm.name.trim()} className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{savingAccount ? "Saving…" : "Save profile"}</button></div>
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setChangingEmail(true); setEmailStep("idle"); }} disabled={!session?.user} className="flex min-h-14 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50 disabled:opacity-40"><span className="grid size-9 place-items-center rounded-xl bg-[#eeebff] text-[#5a4be8]"><Mail size={16}/></span><span className="flex-1"><span className="block text-xs font-black">Change email</span><span className="text-xs text-gray-500">Verify current and new address.</span></span><ChevronRight size={16}/></button>
            <button type="button" onClick={() => setChangingPassword(true)} disabled={!session?.user} className="flex min-h-14 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50 disabled:opacity-40"><span className="grid size-9 place-items-center rounded-xl bg-gray-100 text-gray-600"><KeyRound size={16}/></span><span className="flex-1"><span className="block text-xs font-black">Change password</span><span className="text-xs text-gray-500">Update it without leaving settings.</span></span><ChevronRight size={16}/></button>
          </div>
        </Card>

        {changingEmail ? (
          <Card className="border-[#d9d4ff] bg-[#fbfaff]">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-black">Change email address</h2><p className="mt-1 text-xs text-gray-500">Two verification steps protect this change.</p></div><button type="button" onClick={() => setChangingEmail(false)} className="social-icon-button" aria-label="Close email change"><X size={16}/></button></div>
            {emailStep === "idle" ? <div className="mt-4"><p className="text-xs font-black text-gray-700">Current email</p><p className="mt-1 text-sm font-bold">{email}</p><button type="button" onClick={() => void sendCurrentEmailOtp()} disabled={emailBusy || emailCooldown > 0} className="mt-3 w-full rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{emailBusy ? "Sending…" : emailCooldown ? "Resend in " + emailCooldown + "s" : "Send code to current email"}</button></div> : null}
            {emailStep === "current" ? <div className="mt-4 space-y-3"><label className="block"><span className="mb-1.5 block text-xs font-black">New email</span><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label><label className="block"><span className="mb-1.5 block text-xs font-black">Current-email OTP</span><input inputMode="numeric" maxLength={6} value={currentEmailOtp} onChange={(event) => setCurrentEmailOtp(event.target.value.replace(/\D/g,"").slice(0,6))} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-center tracking-[.4em]"/></label><button type="button" onClick={() => void sendNewEmailOtp()} disabled={emailBusy || currentEmailOtp.length !== 6 || !newEmail.trim()} className="w-full rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{emailBusy ? "Checking…" : "Verify & send new-email code"}</button></div> : null}
            {emailStep === "new" ? <div className="mt-4 space-y-3"><p className="text-xs text-gray-500">We sent a code to <span className="font-black text-gray-800">{newEmail}</span>.</p><label className="block"><span className="mb-1.5 block text-xs font-black">New-email OTP</span><input inputMode="numeric" maxLength={6} value={newEmailOtp} onChange={(event) => setNewEmailOtp(event.target.value.replace(/\D/g,"").slice(0,6))} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-center tracking-[.4em]"/></label><button type="button" onClick={() => void confirmNewEmail()} disabled={emailBusy || newEmailOtp.length !== 6} className="w-full rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{emailBusy ? "Updating…" : "Confirm new email"}</button></div> : null}
          </Card>
        ) : null}

        {changingPassword ? (
          <Card>
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-black">Change password</h2><p className="mt-1 text-xs text-gray-500">Enter your current password, then choose a new one.</p></div><button type="button" onClick={() => setChangingPassword(false)} className="social-icon-button" aria-label="Close password change"><X size={16}/></button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-black">Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label>
              <span className="hidden sm:block"/>
              <label className="block"><span className="mb-1.5 block text-xs font-black">New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black">Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label>
              <label className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 text-xs sm:col-span-2"><input type="checkbox" checked={revokeOtherSessions} onChange={(event) => setRevokeOtherSessions(event.target.checked)} className="size-4 accent-[#6d5dfc]"/><span><span className="block font-black">Sign out other devices</span><span className="text-xs text-gray-500">Revoke other sessions when the password changes.</span></span></label>
              <div className="flex gap-2 sm:col-span-2 sm:justify-end"><button type="button" onClick={() => setChangingPassword(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-600">Cancel</button><button type="button" onClick={() => void changePassword()} disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword} className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{passwordBusy ? "Changing…" : "Change password"}</button></div>
            </div>
          </Card>
        ) : null}

        <Card id="privacy" className={activeSettingsSection === "privacy" ? "block" : "hidden lg:block"}>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#6d5dfc]">Privacy</p>
          <h2 className="mt-1 text-xl font-black">Privacy & presence</h2>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Private account</p><p className="text-xs text-gray-500">Only approved followers can see your posts.</p></div>
              <SettingsToggle value={privateAccount} disabled={!session?.user || savingPrivacy} onChange={(value)=>void updatePrivacy(value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Show Friends / mutual list</p><p className="text-xs text-gray-500">Control whether other people can open your Friends and mutual connections list.</p></div>
              <SettingsToggle value={privacySettings.showFriendsList} disabled={!session?.user || savingPrivacySetting === "showFriendsList"} onChange={(value)=>void updatePrivacySetting("showFriendsList", value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Show followers list</p><p className="text-xs text-gray-500">Control whether other people can open your followers list.</p></div>
              <SettingsToggle value={privacySettings.showFollowersList} disabled={!session?.user || savingPrivacySetting === "showFollowersList"} onChange={(value)=>void updatePrivacySetting("showFollowersList", value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Show following list</p><p className="text-xs text-gray-500">Control whether other people can open your following list.</p></div>
              <SettingsToggle value={privacySettings.showFollowingList} disabled={!session?.user || savingPrivacySetting === "showFollowingList"} onChange={(value)=>void updatePrivacySetting("showFollowingList", value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Allow messages from everyone</p><p className="text-xs text-gray-500">Turn off to limit new direct conversations to accepted friends.</p></div>
              <SettingsToggle value={privacySettings.allowMessagesEveryone} disabled={!session?.user || savingPrivacySetting === "allowMessagesEveryone"} onChange={(value)=>void updatePrivacySetting("allowMessagesEveryone", value)}/>
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1"><p className="text-sm font-bold">Allow friend requests</p><p className="text-xs text-gray-500">Turn off to stop new people from sending friend requests.</p></div>
              <SettingsToggle value={privacySettings.allowFriendRequests} disabled={!session?.user || savingPrivacySetting === "allowFriendRequests"} onChange={(value)=>void updatePrivacySetting("allowFriendRequests", value)}/>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><h2 className="text-sm font-black">Account verification</h2><p className="mt-2 text-xs leading-5 text-gray-500">Verified accounts receive a blue badge. The owner badge is separate and cannot be requested.</p></div>
            <AccountBadge verified={verification.isVerified} owner={verification.isOwner} showLabel size="md"/>
          </div>
          {verification.isVerified || verification.isOwner ? <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs font-bold text-blue-700">Your account already has platform trust status.</div> : verification.status === "PENDING" ? <div className="mt-4 rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black text-amber-800">Verification request pending</p><p className="mt-1 text-xs text-amber-700">Submitted {verification.createdAt ? formatSocialDateTime(verification.createdAt) : "recently"}.</p></div> : <div className="mt-4 space-y-3"><textarea value={verificationReason} onChange={(e)=>setVerificationReason(e.target.value)} rows={4} maxLength={500} placeholder="Explain why your account should be verified (20–500 characters)." className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs outline-none focus:border-[#a79dff] focus:bg-white"/><div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-500">{verificationReason.trim().length}/500 characters</p><button type="button" onClick={()=>void submitVerificationRequest()} disabled={!session?.user || verificationSubmitting || verificationReason.trim().length < 20} className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 disabled:bg-gray-400">{verificationSubmitting?"Submitting…":"Request blue tick"}</button></div>{verification.status==="REJECTED" && verification.adminNote ? <p className="text-xs text-red-600">Previous review: {verification.adminNote}</p> : null}</div>}
        </Card>
<Card id="notifications" className={activeSettingsSection === "notifications" ? "block" : "hidden lg:block"}>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#6d5dfc]">Notifications</p>
          <h2 className="mt-1 text-xl font-black">Choose what reaches you</h2>
          <p className="mt-2 text-xs leading-5 text-gray-500">Choose which activity appears in your notification inbox.</p>
          <div className="mt-4 divide-y divide-gray-100"><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Likes</p><p className="mt-0.5 text-xs text-gray-500">When someone likes your posts.</p></div><SettingsToggle value={Boolean(preferences.likes)} disabled={!session?.user || savingPreference === "likes"} onChange={(value)=>void updatePreference("likes", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Comments</p><p className="mt-0.5 text-xs text-gray-500">When someone comments on your posts.</p></div><SettingsToggle value={Boolean(preferences.comments)} disabled={!session?.user || savingPreference === "comments"} onChange={(value)=>void updatePreference("comments", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Follows</p><p className="mt-0.5 text-xs text-gray-500">When someone follows you.</p></div><SettingsToggle value={Boolean(preferences.follows)} disabled={!session?.user || savingPreference === "follows"} onChange={(value)=>void updatePreference("follows", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Friend requests</p><p className="mt-0.5 text-xs text-gray-500">When someone sends you a friend request.</p></div><SettingsToggle value={Boolean(preferences.friendRequests)} disabled={!session?.user || savingPreference === "friendRequests"} onChange={(value)=>void updatePreference("friendRequests", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Friend requests accepted</p><p className="mt-0.5 text-xs text-gray-500">When a friend request is accepted.</p></div><SettingsToggle value={Boolean(preferences.friendAccepted)} disabled={!session?.user || savingPreference === "friendAccepted"} onChange={(value)=>void updatePreference("friendAccepted", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Messages</p><p className="mt-0.5 text-xs text-gray-500">When you receive a new message notification.</p></div><SettingsToggle value={Boolean(preferences.messages)} disabled={!session?.user || savingPreference === "messages"} onChange={(value)=>void updatePreference("messages", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Mentions</p><p className="mt-0.5 text-xs text-gray-500">When someone mentions you.</p></div><SettingsToggle value={Boolean(preferences.mentions)} disabled={!session?.user || savingPreference === "mentions"} onChange={(value)=>void updatePreference("mentions", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Shares</p><p className="mt-0.5 text-xs text-gray-500">When your content is shared.</p></div><SettingsToggle value={Boolean(preferences.shares)} disabled={!session?.user || savingPreference === "shares"} onChange={(value)=>void updatePreference("shares", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Story replies</p><p className="mt-0.5 text-xs text-gray-500">When someone replies to one of your stories.</p></div><SettingsToggle value={Boolean(preferences.storyReplies)} disabled={!session?.user || savingPreference === "storyReplies"} onChange={(value)=>void updatePreference("storyReplies", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">Story reactions</p><p className="mt-0.5 text-xs text-gray-500">When someone reacts to one of your stories.</p></div><SettingsToggle value={Boolean(preferences.storyReactions)} disabled={!session?.user || savingPreference === "storyReactions"} onChange={(value)=>void updatePreference("storyReactions", value)}/></div><div className="flex items-center gap-4 py-3"><div className="flex-1"><p className="text-xs font-black text-gray-700">System</p><p className="mt-0.5 text-xs text-gray-500">Important account and platform notices.</p></div><SettingsToggle value={Boolean(preferences.system)} disabled={!session?.user || savingPreference === "system"} onChange={(value)=>void updatePreference("system", value)}/></div></div>
        </Card>

        {session?.user ? (
          <Card id="security" className={activeSettingsSection === "security" ? "block" : "hidden lg:block"}>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#6d5dfc]">Security</p><h2 className="mt-1 text-xl font-black">Active sessions</h2><p className="mt-1 text-xs text-gray-500">Review devices signed in to your account.</p></div>
              <button type="button" onClick={() => void revokeSession()} disabled={sessions.length <= 1} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Sign out other devices</button>
            </div>
            <div className="mt-4 space-y-2">
              {loadingSessions ? <div className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-500">Loading sessions…</div> :
               sessions.length ? sessions.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                  <span className={"grid size-9 place-items-center rounded-xl " + (item.isCurrent ? "bg-[#eeebff] text-[#5a4be8]" : "bg-gray-100 text-gray-500")}><Shield size={16}/></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{item.isCurrent ? "Current device" : formatSessionDevice(item.userAgent)}</span><span className="mt-0.5 block truncate text-xs text-gray-500">{item.ipAddress ? item.ipAddress + " · " : ""}{formatSocialDateTime(item.updatedAt)}</span></span>
                  {!item.isCurrent ? <button type="button" onClick={() => void revokeSession(item.id)} className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">Revoke</button> : null}
                </div>
              )) : <div className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-500">No active sessions were found.</div>}
            </div>
            <button onClick={()=>void signOut()} className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50">Sign out current device</button>
          </Card>
        ) : null}

        <Card id="help" className={activeSettingsSection === "help" ? "block" : "hidden lg:block"}>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#6d5dfc]">Help</p>
          <h2 className="mt-1 text-xl font-black">Find the setting you need</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-black">General</p><p className="mt-1 text-xs text-gray-500">Edit profile details, email, or password.</p></div>
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-black">Privacy</p><p className="mt-1 text-xs text-gray-500">Control who can see lists and contact you.</p></div>
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-black">Notifications</p><p className="mt-1 text-xs text-gray-500">Choose which activity notifications stay enabled.</p></div>
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-black">Security</p><p className="mt-1 text-xs text-gray-500">Manage sessions, verification, and account deletion.</p></div>
          </div>
        </Card>

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
  return <AdminWorkspace section={section}/>;
}
export function SocialPages({ screen }: { screen: Screen }) {
  if (screen.kind==="login") return <Auth/>;
  if (screen.kind==="signup") return <Auth signup/>;
  if (screen.kind==="admin") return <Admin section={screen.section}/>;

  const content =
    screen.kind==="profile" ? <Profile username={screen.username}/> :
    screen.kind==="messages" ? <Messages initialConversationId={screen.search}/> :
    screen.kind==="discover" ? <Discover initialQuery={screen.search ?? ""}/> :
    screen.kind==="friends" ? <Friends/> :
    screen.kind==="notifications" ? <Notifications/> :
    screen.kind==="settings" ? <SettingsPage/> :
    <Page eyebrow="Socialhub" title="You're all caught up." subtitle="Use the main navigation to keep exploring the experience."><Card><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-[#eeebff] text-[#5a4be8]"><Sparkles size={20}/></span><div><h2 className="font-black">This route is ready.</h2><p className="mt-2 text-sm text-gray-500">The screen shell is in place so real data can be connected without redesigning the interface.</p></div></div></Card></Page>;

  return <AppShell>{content}</AppShell>;
}