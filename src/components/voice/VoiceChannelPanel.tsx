"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useVoiceCall } from "@/lib/voice-context";
import { listenVoicePresence } from "@/lib/db";
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

export function VoiceChannelPanel({
  serverId,
  channelId,
}: {
  serverId: string;
  channelId: string;
}) {
  const { user } = useAuth();
  const {
    joinedChannelId,
    members: callMembers,
    levels,
    muted,
    full,
    connecting,
    join,
    leave,
    toggleMute,
  } = useVoiceCall();
  const joined = joinedChannelId === channelId;

  // While just viewing (not yet joined) this channel, show a live count of
  // who's already in it - the shared call context only tracks presence for
  // whichever channel is actually joined.
  const [previewMembers, setPreviewMembers] = useState<(VoicePresenceData & { uid: string })[]>(
    []
  );
  useEffect(() => {
    if (joined) return;
    return listenVoicePresence(channelId, setPreviewMembers);
  }, [channelId, joined]);

  const members = joined ? callMembers : previewMembers;
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
          <Button onClick={() => join(serverId, channelId)} loading={connecting}>
            Join Voice Channel
          </Button>
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
            <Button variant="danger" onClick={() => void leave()}>
              <PhoneOff size={18} /> Leave
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
