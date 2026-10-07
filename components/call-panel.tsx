"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type CallUser = {
  id: string;
  name: string;
  username?: string | null;
  image?: string | null;
};

export type WebCall = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  type: "AUDIO" | "VIDEO";
  status: string;
  createdAt: string;
  caller?: CallUser;
  callee?: CallUser;
};

function servers() {
  const list: RTCIceServer[] = [{ urls: process.env.NEXT_PUBLIC_STUN_URL ?? "stun:stun.l.google.com:19302" }];
  const turnUrls = (process.env.NEXT_PUBLIC_TURN_URLS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (turnUrls.length) {
    list.push({
      urls: turnUrls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }
  return list;
}

export default function CallPanel({
  call,
  currentUserId,
  remoteUser,
  incoming = false,
  onClosed,
}: {
  call: WebCall;
  currentUserId: string;
  remoteUser: CallUser;
  incoming?: boolean;
  onClosed: () => void;
}) {
  const [joined, setJoined] = useState(!incoming);
  const [status, setStatus] = useState(call.status === "ACTIVE" ? "Connected" : incoming ? "Incoming call" : "Calling…");
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(call.type === "VIDEO");
  const [speaker, setSpeaker] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastSignalAtRef = useRef<string | null>(null);
  const processedSignalsRef = useRef(new Set<string>());
  const finishedRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const initials = useMemo(
    () => remoteUser.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SH",
    [remoteUser.name],
  );

  async function signal(kind: "OFFER" | "ANSWER" | "CANDIDATE", payload: unknown) {
    await fetch(`/api/calls/${call.id}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
  }

  async function finish(action: "end" | "decline" | "cancel") {
    if (finishedRef.current) return;
    finishedRef.current = true;
    await fetch(`/api/calls/${call.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {});
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    pcRef.current?.close();
    onClosed();
  }

  async function acceptIncoming() {
    try {
      const response = await fetch(`/api/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? "Unable to accept the call.");
      }
      setJoined(true);
      setStatus("Connecting…");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to accept the call.");
      onClosed();
    }
  }

  useEffect(() => {
    if (!joined) return;
    let mounted = true;
    let signalTimer: number | null = null;
    let statusTimer: number | null = null;

    async function processSignals() {
      if (!mounted || finishedRef.current) return;
      const suffix = lastSignalAtRef.current ? `?after=${encodeURIComponent(lastSignalAtRef.current)}` : "";
      const response = await fetch(`/api/calls/${call.id}/signals${suffix}`, { cache: "no-store" });
      if (!response.ok) return;
      const json = await response.json();
      for (const item of json.signals ?? []) {
        if (processedSignalsRef.current.has(item.id)) continue;
        processedSignalsRef.current.add(item.id);
        lastSignalAtRef.current = item.createdAt;
        const pc = pcRef.current;
        if (!pc) continue;
        if (item.kind === "OFFER" && incoming) {
          await pc.setRemoteDescription(item.payload);
          for (const candidate of pendingCandidatesRef.current.splice(0)) await pc.addIceCandidate(candidate);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signal("ANSWER", answer);
          setStatus("Connecting…");
        } else if (item.kind === "ANSWER" && !incoming) {
          await pc.setRemoteDescription(item.payload);
          for (const candidate of pendingCandidatesRef.current.splice(0)) await pc.addIceCandidate(candidate);
          setStatus("Connecting…");
        } else if (item.kind === "CANDIDATE") {
          const candidate = item.payload as RTCIceCandidateInit;
          if (pc.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {});
          else pendingCandidatesRef.current.push(candidate);
        }
      }
    }

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.type === "VIDEO" });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current && call.type === "VIDEO") {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection({ iceServers: servers() });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pc.onicecandidate = (event) => {
          if (event.candidate) void signal("CANDIDATE", event.candidate.toJSON());
        };
        pc.ontrack = (event) => {
          const [remote] = event.streams;
          if (call.type === "VIDEO" && remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
          if (call.type === "AUDIO" && audioRef.current) audioRef.current.srcObject = remote;
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setStatus("Connected");
          else if (pc.connectionState === "connecting") setStatus("Connecting…");
          else if (["failed", "closed", "disconnected"].includes(pc.connectionState)) void finish("end");
        };

        if (!incoming) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signal("OFFER", offer);
        }
      } catch (error) {
        if (mounted) {
          window.alert(error instanceof Error ? error.message : "Camera or microphone access is required.");
          void finish(incoming ? "decline" : "cancel");
        }
      }
    }

    void setup();
    void processSignals();
    signalTimer = window.setInterval(() => void processSignals(), 800);
    statusTimer = window.setInterval(async () => {
      if (finishedRef.current) return;
      const response = await fetch(`/api/calls/${call.id}`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const json = await response.json();
      if (!["RINGING", "ACTIVE"].includes(json.call?.status)) void finish("end");
      if (json.call?.status === "ACTIVE") setStatus("Connected");
    }, 2000);

    return () => {
      mounted = false;
      if (signalTimer) window.clearInterval(signalTimer);
      if (statusTimer) window.clearInterval(statusTimer);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [joined, call.id, call.type, incoming]);

  useEffect(() => {
    if (status !== "Connected") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };
  const toggleCamera = () => {
    if (call.type !== "VIDEO") return;
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraEnabled(next);
  };
  const timer = `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;

  if (!joined) {
    return (
      <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl bg-[#15151d] p-7 text-center text-white shadow-2xl">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-[#725cff] text-3xl font-black">{initials}</div>
          <h2 className="mt-5 text-xl font-black">{remoteUser.name}</h2>
          <p className="mt-1 text-sm text-white/60">{call.type === "VIDEO" ? "Incoming video call" : "Incoming voice call"}</p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <button onClick={() => void finish("decline")} className="rounded-2xl bg-[#8f2028] px-4 py-3 text-sm font-black">Decline</button>
            <button onClick={() => void acceptIncoming()} className="rounded-2xl bg-[#2d9b63] px-4 py-3 text-sm font-black">Accept</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#050507] text-white">
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
        <div><p className="text-base font-black">{call.type === "VIDEO" ? "Video call" : "Voice call"}</p><p className="text-xs text-white/50">{status === "Connected" ? timer : status}</p></div>
        <button onClick={() => void finish("end")} className="grid size-10 place-items-center rounded-xl bg-white/10" aria-label="End call"><X size={18}/></button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {call.type === "VIDEO" ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute right-4 top-4 h-40 w-28 rounded-2xl bg-black/40 object-cover shadow-xl" />
          </>
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div><div className="mx-auto grid size-28 place-items-center rounded-full bg-[#725cff] text-4xl font-black">{initials}</div><h2 className="mt-5 text-2xl font-black">{remoteUser.name}</h2><p className="mt-1 text-sm text-white/50">{status === "Connected" ? timer : status}</p></div>
          </div>
        )}
        <audio ref={audioRef} autoPlay />
      </div>
      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#0b0b11] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
        <button onClick={toggleMute} className={`grid h-14 min-w-14 place-items-center rounded-2xl border border-white/10 ${muted ? "bg-[#29234d]" : "bg-white/10"}`} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <MicOff size={20}/> : <Mic size={20}/>}</button>
        <button onClick={() => { setSpeaker((value) => !value); if (audioRef.current) audioRef.current.volume = speaker ? 0.5 : 1; }} className="grid h-14 min-w-14 place-items-center rounded-2xl border border-white/10 bg-white/10" aria-label="Speaker volume">{speaker ? <Volume2 size={20}/> : <VolumeX size={20}/>}</button>
        {call.type === "VIDEO" ? <button onClick={toggleCamera} className={`grid h-14 min-w-14 place-items-center rounded-2xl border border-white/10 ${cameraEnabled ? "bg-white/10" : "bg-[#29234d]"}`} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}>{cameraEnabled ? <Camera size={20}/> : <CameraOff size={20}/>}</button> : null}
        <button onClick={() => void finish("end")} className="grid h-14 min-w-14 place-items-center rounded-2xl bg-[#b4232e]" aria-label="End call"><Phone size={20}/></button>
      </div>
    </div>
  );
}
