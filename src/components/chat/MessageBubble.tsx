"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { Reply, SmilePlus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useMobileUI } from "@/lib/mobile-ui-context";
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
  const { openProfileCard } = useMobileUI();
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
      <button
        type="button"
        onClick={() => openProfileCard(message.senderId)}
        className="shrink-0 cursor-pointer"
        aria-label={`View ${name}'s profile`}
      >
        <Avatar name={name} src={profile?.avatarUrl} size={36} />
      </button>
      <div className="min-w-0 flex-1">
        {message.replyTo && <ReplyQuote replyTo={message.replyTo} />}
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            onClick={() => openProfileCard(message.senderId)}
            className={`cursor-pointer text-sm font-semibold hover:underline ${isOwn ? "text-accent" : ""}`}
          >
            {name}
          </button>
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

      {/* Kept fully inside the row's own box (no negative offset/translate
          poking into the message above) - group-hover only stays true while
          the pointer is somewhere within this row, so a toolbar straddling
          the boundary into the previous row flickered shut before a click
          could land. Forced visible (ignoring hover) while the reaction
          picker is open, since the picker itself renders *above* this bar
          - reaching into it would otherwise leave the row's hover box and
          slam the whole (CSS-only) group-hover toolbar shut mid-click. */}
      <div
        className={clsx(
          "absolute right-3 top-1 z-10 items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-sm",
          pickerOpen ? "flex" : "hidden group-hover:flex"
        )}
      >
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
