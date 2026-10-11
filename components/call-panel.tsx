"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const [status, setStatus] = useState(call.status === "ACTIVE" ? "Connected" : incoming ? "Incoming call" : "Callingâ€¦");
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(call.type¶»§q«^