"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { createPeer, watchAudioLevel, type MediaConnection } from "@/lib/peer";
import type Peer from "@/lib/peer";
import { joinVoiceChannel, leaveVoiceChannel, listenVoicePresence } from "@/lib/db";
import { MAX_VC_USERS } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { VoicePresenceData } from "@/types";

function ParticipantTile({
  uid,
  level,
  muted,
}: {
  uid: string;
  level: number;
  muted?: boolean;
}) {
  const profile = useUserProfile(uid);
  const name = profile?.username ?? "...";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 10 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0.35 }}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4"
    >
      <motion.div
        animate={{
          boxShadow: `0 0 0 ${4 + level * 10}px rgba(35,165,90,${0.15 + level * 0.35})`,
        }}
        transition={{ duration: 0.08 }}
        className="rounded-full"
      >
        <Avatar name={name} src={profile?.avatarUrl} size={64} />
      </motion.div>
      <span className="flex items-center gap-1 text-sm font-medium">
        {muted && <MicOff size={14} className="text-danger" />}
        {name}
      </span>
    </motion.div>
  );
}

export function VoiceChannelPanel({ channelId }: { channelId: string }) {
  const { user, profile } = useAuth();
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState<(VoicePresenceData & { uid: string })[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map());
  const cleanupFnsRef = useRef<Map<string, () => void>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const joinedRef = useRef(false);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => listenVoicePresence(channelId, setMembers), [channelId]);

  function registerCall(uid: string, call: MediaConnection) {
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
  }

  function teardownConnection(uid: string) {
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
  }

  async function handleLeave() {
    for (const uid of Array.from(connectionsRef.current.keys())) teardownConnection(uid);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    if (user) await leaveVoiceChannel(channelId, user.uid);
    setJoined(false);
    setMuted(false);
  }

  useEffect(() => {
    // Leave the channel if the component unmounts while still connected
    // (route change to another channel, or navigating away entirely).
    return () => {
      if (joinedRef.current) void handleLeave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    if (!joined || !user) return;
    const currentUids = new Set(members.map((m) => m.uid));
    for (const m of members) {
      if (m.uid === user.uid) continue;
      if (connectionsRef.current.has(m.uid)) continue;
      // Every member's client runs this same effect on every presence
      // change, so without a tie-breaker both sides of a pair would dial
      // each other at once (two separate MediaConnections per pair,
      // fighting over the same `uid` key/audio element). Only the
      // lower-uid side initiates; the other side answers via the
      // `peer.on("call", ...)` handler registered in handleJoin.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, joined]);

  async function handleJoin() {
    if (!user || !profile) return;
    setFull(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Couldn't access the microphone. Check your browser permissions.");
      return;
    }
    let peer: Peer;
    try {
      peer = await createPeer();
    } catch {
      alert("Couldn't connect to the voice server, try again.");
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const ok = await joinVoiceChannel(channelId, user.uid, peer.id, profile.username);
    if (!ok) {
      setFull(true);
      peer.destroy();
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    peer.on("call", (call) => {
      call.answer(stream);
      registerCall(call.peer, call);
    });
    peerRef.current = peer;
    localStreamRef.current = stream;
    setJoined(true);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  const otherMembers = members.filter((m) => m.uid !== user?.uid);
  const meMember = members.find((m) => m.uid === user?.uid);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8">
      {!joined ? (
        <motion.div
          key="prompt"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-3"
        >
          <Volume2 size={40} className="text-muted" />
          <p className="text-sm text-muted">
            {members.length}/{MAX_VC_USERS} in this channel
          </p>
          {full && <p className="text-sm text-danger">Channel is full (4/4).</p>}
          <Button onClick={handleJoin}>Join Voice Channel</Button>
        </motion.div>
      ) : (
        <>
          <div className="grid w-full max-w-xl grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {meMember && (
                <ParticipantTile
                  key={meMember.uid}
                  uid={meMember.uid}
                  level={muted ? 0 : levels[meMember.uid] ?? 0}
                  muted={muted}
                />
              )}
              {otherMembers.map((m) => (
                <ParticipantTile key={m.uid} uid={m.uid} level={levels[m.uid] ?? 0} />
              ))}
            </AnimatePresence>
          </div>
          <div className="flex gap-3">
            <Button variant={muted ? "danger" : "outline"} onClick={toggleMute}>
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="danger" onClick={handleLeave}>
              <PhoneOff size={18} /> Leave
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
