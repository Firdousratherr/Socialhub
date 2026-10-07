import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import InCallManager from "react-native-incall-manager";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from "react-native-webrtc";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "../lib/api";
import { subscribeRealtime } from "../lib/realtime";
import type { User } from "../types";

export type NativeCallType = "AUDIO" | "VIDEO";

export type NativeCall = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  type: NativeCallType;
  status: string;
  createdAt: string;
  caller?: User;
  callee?: User;
};

function rtcIceServers() {
  const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: process.env.EXPO_PUBLIC_STUN_URL ?? "stun:stun.l.google.com:19302" },
  ];
  const turnUrls = (process.env.EXPO_PUBLIC_TURN_URLS ?? "")
    .split(",")
    .map((item: string) => item.trim())
    .filter(Boolean);
  if (turnUrls.length) {
    servers.push({
      urls: turnUrls,
      username: process.env.EXPO_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }
  return servers;
}

export default function CallScreen({
  call,
  currentUserId,
  remoteUser,
  incoming = false,
  onFinished,
}: {
  call: NativeCall;
  currentUserId: string;
  remoteUser: User;
  incoming?: boolean;
  onFinished: () => void;
}) {
  const insets = useSafeAreaInsets();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const processedSignals = useRef(new Set<string>());
  const lastSignalAt = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState("");
  const [localStreamUrl, setLocalStreamUrl] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(call.type === "VIDEO");
  const [speaker, setSpeaker] = useState(call.type === "VIDEO");
  const [status, setStatus] = useState(call.status === "ACTIVE" ? "Connected" : incoming ? "Incoming call" : "Calling…");
  const [elapsed, setElapsed] = useState(0);

  const otherInitial = useMemo(
    () => remoteUser.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SH",
    [remoteUser.name],
  );

  const finish = async (action: "end" | "decline" | "cancel") => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      await apiFetch(`/api/calls/${call.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
    } catch {
      // Best-effort; local media still needs to be released.
    }
    try { InCallManager.stop(); } catch {}
    localRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    onFinished();
  };

  const sendSignal = async (kind: "OFFER" | "ANSWER" | "CANDIDATE", payload: unknown) => {
    try {
      await apiFetch(`/api/calls/${call.id}/signals`, {
        method: "POST",
        body: JSON.stringify({ kind, payload }),
      });
    } catch (error) {
      if (!finishedRef.current) {
        Alert.alert("Call", error instanceof Error ? error.message : "Unable to exchange call data.");
      }
    }
  };

  const applyCandidate = async (payload: unknown) => {
    const pc = peerRef.current;
    if (!pc) return;
    try {
      const candidate = new RTCIceCandidate(payload as Record<string, unknown>);
      if (pc.remoteDescription) await pc.addIceCandidate(candidate);
      else pendingCandidates.current.push(candidate);
    } catch {
      // Ignore malformed/stale candidates.
    }
  };

  useEffect(() => {
    let mounted = true;
    let signalTimer: ReturnType<typeof setInterval> | null = null;
    let statusTimer: ReturnType<typeof setInterval> | null = null;

    const processSignals = async () => {
      if (!mounted || finishedRef.current) return;
      try {
        const suffix = lastSignalAt.current ? `?after=${encodeURIComponent(lastSignalAt.current)}` : "";
        const data = await apiFetch<{ signals: Array<{ id: string; kind: string; payload: unknown; createdAt: string }>}>(`/api/calls/${call.id}/signals${suffix}`);
        for (const signal of data.signals ?? []) {
          if (processedSignals.current.has(signal.id)) continue;
          processedSignals.current.add(signal.id);
          lastSignalAt.current = signal.createdAt;

          const pc = peerRef.current;
          if (!pc) continue;

          if (signal.kind === "OFFER" && incoming) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
            for (const candidate of pendingCandidates.current.splice(0)) await pc.addIceCandidate(candidate);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal("ANSWER", answer);
            setStatus("Connecting…");
          } else if (signal.kind === "ANSWER" && !incoming) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as Record<string, unknown>));
            for (const candidate of pendingCandidates.current.splice(0)) await pc.addIceCandidate(candidate);
            setStatus("Connecting…");
          } else if (signal.kind === "CANDIDATE") {
            await applyCandidate(signal.payload);
          }
        }
      } catch {
        // Retry on the next poll.
      }
    };

    const setup = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: call.type === "VIDEO",
        });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localRef.current = stream;
        setLocalStreamUrl(stream.toURL());
        const pc = new RTCPeerConnection({ iceServers: rtcIceServers() });
        peerRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pc.onicecandidate = (event: any) => {
          if (event.candidate) void sendSignal("CANDIDATE", event.candidate.toJSON());
        };
        pc.ontrack = (event: any) => {
          const stream = event.streams?.[0];
          if (!stream) return;
          remoteRef.current = stream;
          setRemoteStreamUrl(stream.toURL());
        };
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") setStatus("Connected");
          else if (state === "connecting") setStatus("Connecting…");
          else if (state === "failed" || state === "closed" || state === "disconnected") {
            void finish("end");
          }
        };

        InCallManager.start({
          media: call.type === "VIDEO" ? "video" : "audio",
          ringback: !incoming ? "_DEFAULT_" : "",
        });
        InCallManager.setForceSpeakerphoneOn(call.type === "VIDEO");

        if (!incoming) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal("OFFER", offer);
        }
      } catch (error) {
        if (mounted) {
          Alert.alert(
            "Call unavailable",
            error instanceof Error
              ? error.message
              : "Camera or microphone access is required to place this call.",
            [{ text: "Close", onPress: () => void finish(incoming ? "decline" : "cancel") }],
          );
        }
      }
    };

    void setup();
    void processSignals();
    signalTimer = setInterval(() => void processSignals(), 800);
    statusTimer = setInterval(async () => {
      if (finishedRef.current) return;
      try {
        const data = await apiFetch<{ call: NativeCall }>(`/api/calls/${call.id}`);
        if (!["RINGING", "ACTIVE"].includes(data.call.status)) {
          await finish("end");
        } else if (data.call.status === "ACTIVE") {
          setStatus("Connected");
        }
      } catch {}
    }, 2000);

    const unsubscribe = subscribeRealtime((event) => {
      if (event.entityId !== call.id) return;
      if (event.type === "call.updated") {
        const nextStatus = String(event.payload?.status ?? "");
        if (["DECLINED", "MISSED", "ENDED", "CANCELLED"].includes(nextStatus)) {
          void finish("end");
        }
        if (nextStatus === "ACTIVE") setStatus("Connected");
      }
    });

    return () => {
      mounted = false;
      if (signalTimer) clearInterval(signalTimer);
      if (statusTimer) clearInterval(statusTimer);
      unsubscribe();
      try { InCallManager.stop(); } catch {}
      localRef.current?.getTracks().forEach((track) => track.stop());
      peerRef.current?.close();
      peerRef.current = null;
    };
  }, [call.id, call.type, incoming]);

  useEffect(() => {
    if (status !== "Connected") return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const toggleMute = () => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  const toggleCamera = () => {
    if (call.type !== "VIDEO") return;
    const next = !cameraEnabled;
    localRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraEnabled(next);
  };

  const toggleSpeaker = () => {
    const next = !speaker;
    setSpeaker(next);
    try { InCallManager.setForceSpeakerphoneOn(next); } catch {}
  };

  const formatElapsed = () => {
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const seconds = (elapsed % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.typeText}>{call.type === "VIDEO" ? "Video call" : "Voice call"}</Text>
        <Text style={styles.timer}>{status === "Connected" ? formatElapsed() : status}</Text>
      </View>

      {call.type === "VIDEO" ? (
        <View style={styles.videoStage}>
          {remoteStreamUrl ? (
            <RTCView streamURL={remoteStreamUrl} style={styles.remoteVideo} objectFit="cover" />
          ) : (
            <View style={styles.videoPlaceholder}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{otherInitial}</Text></View>
              <Text style={styles.name}>{remoteUser.name}</Text>
              <Text style={styles.status}>{status}</Text>
            </View>
          )}
          {localStreamUrl && cameraEnabled ? (
            <RTCView streamURL={localStreamUrl} style={styles.localVideo} objectFit="cover" />
          ) : null}
        </View>
      ) : (
        <View style={styles.voiceStage}>
          <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{otherInitial}</Text></View>
          <Text style={styles.name}>{remoteUser.name}</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
      )}

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom + 14, 20) }]}>
        <Pressable onPress={toggleMute} style={[styles.control, muted && styles.controlActive]}>
          <Text style={styles.controlIcon}>{muted ? "🔇" : "🎙️"}</Text>
          <Text style={styles.controlLabel}>{muted ? "Unmute" : "Mute"}</Text>
        </Pressable>
        <Pressable onPress={toggleSpeaker} style={[styles.control, speaker && styles.controlActive]}>
          <Text style={styles.controlIcon}>{speaker ? "🔊" : "🔉"}</Text>
          <Text style={styles.controlLabel}>{speaker ? "Speaker" : "Earpiece"}</Text>
        </Pressable>
        {call.type === "VIDEO" ? (
          <Pressable onPress={toggleCamera} style={[styles.control, !cameraEnabled && styles.controlActive]}>
            <Text style={styles.controlIcon}>{cameraEnabled ? "📹" : "🚫"}</Text>
            <Text style={styles.controlLabel}>{cameraEnabled ? "Camera" : "Camera off"}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void finish("end")} style={styles.endControl}>
          <Text style={styles.endIcon}>☎</Text>
          <Text style={styles.controlLabel}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function IncomingCallPrompt({
  call,
  caller,
  onAccept,
  onDecline,
}: {
  call: NativeCall;
  caller: User;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.incomingCard}>
        <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{caller.name.slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.incomingTitle}>{caller.name}</Text>
        <Text style={styles.status}>{call.type === "VIDEO" ? "Incoming video call" : "Incoming voice call"}</Text>
        <View style={styles.incomingActions}>
          <Pressable onPress={onDecline} style={[styles.incomingButton, styles.decline]}>
            <Text style={styles.incomingButtonText}>Decline</Text>
          </Pressable>
          <Pressable onPress={onAccept} style={[styles.incomingButton, styles.accept]}>
            <Text style={styles.incomingButtonText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050507" },
  top: { paddingHorizontal: 18, paddingBottom: 12, alignItems: "center" },
  typeText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  timer: { color: "#9c9ca9", fontSize: 12, marginTop: 4 },
  videoStage: { flex: 1, position: "relative", backgroundColor: "#0a0a0e" },
  remoteVideo: { flex: 1, width: "100%", height: "100%" },
  localVideo: { position: "absolute", width: 120, height: 170, right: 14, top: 14, borderRadius: 18, overflow: "hidden", backgroundColor: "#12121a" },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  voiceStage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  avatar: { width: 94, height: 94, borderRadius: 47, backgroundColor: "#25233a", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "900" },
  avatarLarge: { width: 112, height: 112, borderRadius: 56, backgroundColor: "#725cff", alignItems: "center", justifyContent: "center" },
  avatarLargeText: { color: "#fff", fontSize: 42, fontWeight: "900" },
  name: { color: "#fff", fontSize: 22, fontWeight: "900" },
  status: { color: "#9c9ca9", fontSize: 13 },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 18, backgroundColor: "#0b0b11" },
  control: { width: 78, minHeight: 64, borderRadius: 18, backgroundColor: "#171720", borderWidth: 1, borderColor: "#272733", alignItems: "center", justifyContent: "center" },
  controlActive: { backgroundColor: "#29234d", borderColor: "#725cff" },
  controlIcon: { fontSize: 20 },
  controlLabel: { color: "#fff", fontSize: 10, fontWeight: "800", marginTop: 4 },
  endControl: { width: 78, minHeight: 64, borderRadius: 18, backgroundColor: "#b4232e", alignItems: "center", justifyContent: "center" },
  endIcon: { color: "#fff", fontSize: 22 },
  incomingButton: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  incomingActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 20 },
  incomingCard: { marginHorizontal: 20, width: "88%", maxWidth: 380, alignItems: "center", backgroundColor: "#15151d", borderRadius: 28, padding: 26, borderWidth: 1, borderColor: "#2a2a38" },
  incomingTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 16 },
  incomingButtonText: { color: "#fff", fontWeight: "900" },
  decline: { backgroundColor: "#8f2028" },
  accept: { backgroundColor: "#2d9b63" },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.76)", zIndex: 100 },
});
