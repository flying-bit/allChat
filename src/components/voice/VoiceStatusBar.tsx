"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { useVoiceCall } from "@/lib/voice-context";
import { listenChannelMeta } from "@/lib/db";
import type { ChannelData } from "@/types";

// Shown app-wide (mounted once in the /app layout) whenever the user is
// connected to a voice channel but currently looking at something else -
// a text channel, DMs, another server - so the call stays visible and
// controllable instead of silently running in the background.
export function VoiceStatusBar() {
  const { joinedChannelId, joinedServerId, muted, toggleMute, leave } = useVoiceCall();
  const params = useParams<{ channelId?: string }>();
  const [channel, setChannel] = useState<ChannelData | null>(null);

  useEffect(() => {
    if (!joinedChannelId || !joinedServerId) return;
    return listenChannelMeta(joinedServerId, joinedChannelId, setChannel);
  }, [joinedChannelId, joinedServerId]);

  const onVoiceChannelPage = joinedChannelId && params.channelId === joinedChannelId;
  const visible = Boolean(joinedChannelId && joinedServerId && !onVoiceChannelPage);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
          className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2"
        >
          <span className="flex shrink-0 items-center justify-center rounded-full bg-accent/15 p-1.5 text-accent">
            <Volume2 size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {channel?.name ?? "Voice channel"}
            </p>
            <p className="text-[11px] text-muted">Sesli sohbete bağlısın</p>
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
            href={`/app/servers/${joinedServerId}/channels/${joinedChannelId}`}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline"
          >
            Dön
          </Link>
          <button
            type="button"
            onClick={() => void leave()}
            className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger cursor-pointer"
            aria-label="Leave voice channel"
          >
            <PhoneOff size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
