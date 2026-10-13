"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Check, Lock, LogIn, Mail, Send, Sparkles } from "lucide-react";

export function AuthForm({ signup = false, nextPath = "/home" }: { signup?: boolean; nextPath?: string }) {
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
      const signIn = await authClient.signIn.email({ email: email.trim(), password, callbackURL: nextPath });
      if (signIn.error) throw new Error(signIn.error.message || "Email verified, but sign-in could not be completed.");
      router.replace(nextPath); router.refresh();
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
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: nextPath })
        : await authClient.signIn.email({ email: email.trim(), password, rememberMe, callbackURL: nextPath });
      if (result.error) { setError(result.error.message || "Authentication failed. Please try again."); return; }
      if (signup) {
        setStep("verify-signup"); setOtp(""); setCooldown(30);
        setNotice("We sent a 6-digit verification code to your email.");
        return;
      }
      router.replace(nextPath); router.refresh();
    } catch {
      setError("We could not reach the authentication service. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  async function continueWithGoogle() {
    if (loading) return;
    setError(""); setNotice(""); setLoading(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: nextPath });
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
