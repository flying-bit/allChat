"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDmCall } from "@/lib/dm-call-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { watchAudioLevel } from "@/lib/peer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

function CallTile({
  uid,
  stream,
  level,
  isLocal,
}: {
  uid: string;
  stream: MediaStream | null;
  level: number;
  isLocal?: boolean;
}) {
  const profile = useUserProfile(uid);
  const name = profile?.username ?? "...";
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(stream && stream.getVideoTracks().length > 0);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = hasVideo ? stream : null;
  }, [stream, hasVideo]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-2">
      {hasVideo ? (
        // Local preview is muted (we don't need to hear our own mic through
        // the tag) and mirrored, matching how every other video call app
        // shows your own camera back to you.
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`h-full w-full object-cover ${isLocal ? "[transform:scaleX(-1)]" : ""}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <motion.div
            animate={{ boxShadow: `0 0 0 ${4 + level * 10}px rgba(35,165,90,${0.15 + level * 0.35})` }}
            transition={{ duration: 0.08 }}
            className="rounded-full"
          >
            <Avatar name={name} src={profile?.avatarUrl} size={56} />
          </motion.div>
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
        {name}
      </span>
    </div>
  );
}

// Rendered inline at the top of a DM's chat (not a full-screen takeover -
// the message list and composer stay reachable underneath/below it), only
// while the call in progress is with the person whose DM you're currently
// looking at. If you navigate elsewhere mid-call, DmCallBar takes over as
// the visible "still connected" affordance instead.
export function DmCallPanel({ otherUid }: { otherUid: string }) {
  const { user } = useAuth();
  const { activeCall, localStream, remoteStream, muted, cameraOn, cameraBusy, toggleMute, toggleCamera, hangUp } =
    useDmCall();
  const otherProfile = useUserProfile(otherUid);
  const [localLevel, setLocalLevel] = useState(0);
  const [remoteLevel, setRemoteLevel] = useState(0);

  useEffect(() => {
    if (!localStream) return;
    return watchAudioLevel(localStream, setLocalLevel);
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    return watchAudioLevel(remoteStream, setRemoteLevel);
  }, [remoteStream]);

  if (!activeCall || activeCall.otherUid !== otherUid) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b border-border bg-surface p-3"
    >
      {activeCall.status === "ringing" ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{otherProfile?.username ?? "..."}</span> aranıyor...
          </p>
          <Button variant="danger" onClick={hangUp}>
            <PhoneOff size={16} /> İptal
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <CallTile
              uid={otherUid}
              stream={remoteStream}
              level={remoteStream ? remoteLevel : 0}
            />
            {user && (
              <CallTile
                uid={user.uid}
                stream={localStream}
                level={muted || !localStream ? 0 : localLevel}
                isLocal
              />
            )}
          </div>
          <div className="mt-2 flex justify-center gap-2">
            <Button variant={muted ? "danger" : "outline"} onClick={toggleMute}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </Button>
            <Button
              variant={cameraOn ? "primary" : "outline"}
              onClick={() => void toggleCamera()}
              loading={cameraBusy}
            >
              {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </Button>
            <Button variant="danger" onClick={hangUp}>
              <PhoneOff size={16} />
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
