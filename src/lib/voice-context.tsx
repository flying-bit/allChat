"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { createPeer, watchAudioLevel, type MediaConnection } from "@/lib/peer";
import type Peer from "@/lib/peer";
import { joinVoiceChannel, leaveVoiceChannel, listenVoicePresence } from "@/lib/db";
import type { VoicePresenceData } from "@/types";

// Lives above the channel router (mounted once in the /app layout) so the
// PeerJS connection and mic stream survive navigating from a voice channel
// to a text channel - joining a voice channel used to be owned by
// VoiceChannelPanel itself, which meant leaving its page (even to go type
// in a text channel) tore the call down. Moving the connection up here
// lets you stay connected while you browse elsewhere; VoiceChannelPanel and
// VoiceStatusBar are now just views onto this shared state.
interface VoiceCallContextValue {
  joinedChannelId: string | null;
  joinedServerId: string | null;
  members: (VoicePresenceData & { uid: string })[];
  levels: Record<string, number>;
  muted: boolean;
  full: boolean;
  connecting: boolean;
  join: (serverId: string, channelId: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [joinedChannelId, setJoinedChannelId] = useState<string | null>(null);
  const [joinedServerId, setJoinedServerId] = useState<string | null>(null);
  const [members, setMembers] = useState<(VoicePresenceData & { uid: string })[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map());
  const cleanupFnsRef = useRef<Map<string, () => void>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const joinedChannelRef = useRef<string | null>(null);
  const userRef = useRef(user);

  useEffect(() => {
    joinedChannelRef.current = joinedChannelId;
  }, [joinedChannelId]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!joinedChannelId) return;
    return listenVoicePresence(joinedChannelId, setMembers);
  }, [joinedChannelId]);

  const teardownConnection = useCallback((uid: string) => {
    connectionsRef.current.get(uid)?.close();
    connectionsRef.current.delete(uid);
    cleanupFnsRef.current.get(uid)?.();
    cleanupFnsRef.current.delete(uid);
    const audioEl = audioElsRef.current.get(uid);
    if (audioEl) {
      audioEl.srcObject = null;
      audioElsRef.current.delete(uid);
    }
    setLevels((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  }, []);

  const registerCall = useCallback(
    (uid: string, call: MediaConnection) => {
      connectionsRef.current.set(uid, call);
      call.on("stream", (remoteStream) => {
        let audioEl = audioElsRef.current.get(uid);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioElsRef.current.set(uid, audioEl);
        }
        audioEl.srcObject = remoteStream;
        const stopWatch = watchAudioLevel(remoteStream, (level) =>
          setLevels((prev) => ({ ...prev, [uid]: level }))
        );
        cleanupFnsRef.current.set(uid, stopWatch);
      });
      call.on("close", () => teardownConnection(uid));
      call.on("error", () => teardownConnection(uid));
    },
    [teardownConnection]
  );

  const leave = useCallback(async () => {
    const channelId = joinedChannelRef.current;
    for (const uid of Array.from(connectionsRef.current.keys())) teardownConnection(uid);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    if (userRef.current && channelId) await leaveVoiceChannel(channelId, userRef.current.uid);
    setJoinedChannelId(null);
    setJoinedServerId(null);
    setMuted(false);
    setMembers([]);
  }, [teardownConnection]);

  // Leave when the provider itself unmounts (e.g. signing out).
  useEffect(() => {
    return () => {
      if (joinedChannelRef.current) void leave();
    };
  }, [leave]);

  // Dial newly-present members, tear down connections for members who left.
  useEffect(() => {
    if (!joinedChannelId || !user) return;
    const currentUids = new Set(members.map((m) => m.uid));
    for (const m of members) {
      if (m.uid === user.uid) continue;
      if (connectionsRef.current.has(m.uid)) continue;
      // Tie-breaker so both sides of a pair don't dial each other at once.
      if (user.uid > m.uid) continue;
      const peer = peerRef.current;
      const localStream = localStreamRef.current;
      if (!peer || !localStream) continue;
      const call = peer.call(m.peerId, localStream);
      registerCall(m.uid, call);
    }
    for (const uid of Array.from(connectionsRef.current.keys())) {
      if (!currentUids.has(uid)) teardownConnection(uid);
    }
  }, [members, joinedChannelId, user, registerCall, teardownConnection]);

  const join = useCallback(
    async (serverId: string, channelId: string) => {
      if (!user || !profile) return;
      if (joinedChannelRef.current === channelId) return;
      if (joinedChannelRef.current) await leave();
      setFull(false);
      setConnecting(true);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert("Couldn't access the microphone. Check your browser permissions.");
        setConnecting(false);
        return;
      }
      let peer: Peer;
      try {
        peer = await createPeer();
      } catch {
        alert("Couldn't connect to the voice server, try again.");
        stream.getTracks().forEach((t) => t.stop());
        setConnecting(false);
        return;
      }
      const ok = await joinVoiceChannel(channelId, user.uid, peer.id, profile.username);
      if (!ok) {
        setFull(true);
        peer.destroy();
        stream.getTracks().forEach((t) => t.stop());
        setConnecting(false);
        return;
      }
      peer.on("call", (call) => {
        call.answer(stream);
        registerCall(call.peer, call);
      });
      peerRef.current = peer;
      localStreamRef.current = stream;
      setJoinedChannelId(channelId);
      setJoinedServerId(serverId);
      setConnecting(false);
    },
    [user, profile, leave, registerCall]
  );

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMuted((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const value: VoiceCallContextValue = {
    joinedChannelId,
    joinedServerId,
    members,
    levels,
    muted,
    full,
    connecting,
    join,
    leave,
    toggleMute,
  };

  return <VoiceCallContext.Provider value={value}>{children}</VoiceCallContext.Provider>;
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within VoiceCallProvider");
  return ctx;
}
