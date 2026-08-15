"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useDmCall } from "@/lib/dm-call-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Avatar } from "@/components/ui/Avatar";

// Mirrors VoiceStatusBar's role for server voice channels: shown app-wide
// whenever there's a DM call in progress but the user has navigated away
// from that DM's page, so the call stays visible and controllable instead
// of silently running in the background.
export function DmCallBar() {
  const { activeCall, muted, toggleMute, hangUp } = useDmCall();
  const params = useParams<{ uid?: string }>();
  const profile = useUserProfile(activeCall?.otherUid);

  const onCallPage = activeCall && params.uid === activeCall.otherUid;
  const visible = Boolean(activeCall && !onCallPage);

  return (
    <AnimatePresence>
      {visible && activeCall && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
          className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2"
        >
          <Avatar name={profile?.username ?? "..."} src={profile?.avatarUrl} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {profile?.username ?? "..."}
            </p>
            <p className="text-[11px] text-muted">
              {activeCall.status === "ringing" ? "Aranıyor..." : "Görüşme sürüyor"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff size={16} className="text-danger" /> : <Mic size={16} />}
          </button>
          <Link
            href={`/app/dm/${activeCall.otherUid}`}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline"
          >
            Dön
          </Link>
          <button
            type="button"
            onClick={hangUp}
            className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger cursor-pointer"
            aria-label="Hang up"
          >
            <PhoneOff size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
