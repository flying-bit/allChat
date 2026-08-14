"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { Reply, SmilePlus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { clsx } from "@/lib/clsx";
import { ReactionPicker } from "./ReactionPicker";
import type { MessageData, ReactionMap } from "@/types";

function ReplyQuote({ replyTo }: { replyTo: NonNullable<MessageData["replyTo"]> }) {
  const profile = useUserProfile(replyTo.senderId);
  return (
    <div className="mb-0.5 flex items-center gap-1 pl-3 text-xs text-muted">
      <Reply size={12} className="shrink-0 -scale-x-100" />
      <span className="font-medium text-foreground/80">{profile?.username ?? "..."}</span>
      <span className="truncate">
        {replyTo.text || (replyTo.hasImage ? "📷 Photo" : "")}
      </span>
    </div>
  );
}

function ReactionRow({
  reactions,
  currentUid,
  onToggle,
}: {
  reactions: ReactionMap;
  currentUid: string;
  onToggle: (emoji: string, active: boolean) => void;
}) {
  const entries = Object.entries(reactions).filter(([, uids]) => Object.keys(uids).length > 0);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([emoji, uids]) => {
        const count = Object.keys(uids).length;
        const mine = Boolean(uids[currentUid]);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji, !mine)}
            className={clsx(
              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs cursor-pointer transition-colors",
              mine
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border bg-surface-2 text-muted hover:bg-surface-2/70"
            )}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MessageBubble({
  message,
  isOwn,
  reactions,
  currentUid,
  onReply,
  onDelete,
  onReact,
}: {
  message: MessageData;
  isOwn: boolean;
  reactions?: ReactionMap;
  currentUid: string;
  onReply: (message: MessageData) => void;
  onDelete: (messageId: string) => void;
  onReact: (emoji: string, active: boolean) => void;
}) {
  const profile = useUserProfile(message.senderId);
  const ref = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, {
      opacity: [0, 1],
      translateY: [10, 0],
      scale: [0.98, 1],
      duration: 320,
      ease: "outQuint",
    });
  }, []);

  const name = profile?.username ?? "...";
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      ref={ref}
      className="group relative flex gap-3 px-4 py-1.5 hover:bg-surface-2/50"
    >
      <Avatar name={name} src={profile?.avatarUrl} size={36} />
      <div className="min-w-0 flex-1">
        {message.replyTo && <ReplyQuote replyTo={message.replyTo} />}
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${isOwn ? "text-accent" : ""}`}>{name}</span>
          <span className="text-[11px] text-muted">{time}</span>
        </div>
        {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
        {message.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.imageUrl}
            alt="attachment"
            className="mt-1 max-h-80 max-w-sm rounded-lg border border-border object-contain"
          />
        )}
        {reactions && (
          <ReactionRow reactions={reactions} currentUid={currentUid} onToggle={onReact} />
        )}
      </div>

      <div className="absolute right-3 top-0 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-sm group-hover:flex">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer"
            aria-label="Add reaction"
          >
            <SmilePlus size={15} />
          </button>
          <ReactionPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={(emoji) => onReact(emoji, !reactions?.[emoji]?.[currentUid])}
          />
        </div>
        <button
          type="button"
          onClick={() => onReply(message)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer"
          aria-label="Reply"
        >
          <Reply size={15} />
        </button>
        {isOwn && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger cursor-pointer"
            aria-label="Delete message"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
