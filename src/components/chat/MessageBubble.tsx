"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { animate } from "animejs";
import { Reply, SmilePlus, Star, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useMobileUI } from "@/lib/mobile-ui-context";
import { clsx } from "@/lib/clsx";
import { ReactionPicker } from "./ReactionPicker";
import type { MessageData, ReactionMap } from "@/types";

// Messages don't record whether an image came from the GIF picker vs. a
// pasted screenshot, so the star (favoriting) only offers itself on images
// that look like a GIF by URL - same heuristic GifPicker's own fallback
// extractor uses to recognize a GIF URL in the first place.
const GIF_URL_RE = /\.(gif|webp)(\?|$)/i;

// http(s) only - deliberately excludes javascript:/data: etc, which would
// otherwise turn "clickable link" into a stored-XSS vector via an <a href>
// built straight from user text.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+\.[a-z]{2,}[^\s<]*)/gi;

// Trailing punctuation (sentence-ending periods, a closing paren someone
// typed around the link, etc.) shouldn't get swallowed into the href.
// Parens are only trimmed when unbalanced within the URL, so a link that
// legitimately ends in ")" (e.g. a Wikipedia disambiguation URL) survives.
function splitTrailingPunctuation(url: string): { url: string; trailing: string } {
  let trailing = "";
  while (url.length > 0) {
    const last = url[url.length - 1];
    if (last === ")") {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
    } else if (!".,!?;:'\"".includes(last)) {
      break;
    }
    trailing = last + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

function linkifyText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const index = match.index ?? 0;
    const { url, trailing } = splitTrailingPunctuation(match[0]);
    if (!url) continue;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    nodes.push(
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => e.stopPropagation()}
        className="break-all text-blue-600 underline hover:opacity-80 dark:text-blue-400"
      >
        {url}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = index + match[0].length;
  }
  if (nodes.length === 0) return [text];
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}

function ReplyQuote({ replyTo }: { replyTo: NonNullable<MessageData["replyTo"]> }) {
  const profile = useUserProfile(replyTo.senderId);
  return (
    <div className="mb-0.5 flex items-center gap-1 pl-3 text-xs text-muted">
      <Reply size={12} className="shrink-0 -scale-x-100" />
      <span className="font-medium text-foreground/80">{profile?.username ?? "..."}</span>
      <span className="truncate">
        {replyTo.text || (replyTo.hasVideo ? "🎬 Video" : replyTo.hasImage ? "📷 Photo" : "")}
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
  grouped,
  isGifFavorite,
  onToggleGifFavorite,
  onReply,
  onDelete,
  onReact,
}: {
  message: MessageData;
  isOwn: boolean;
  reactions?: ReactionMap;
  currentUid: string;
  grouped?: boolean;
  isGifFavorite?: boolean;
  onToggleGifFavorite?: () => void;
  onReply: (message: MessageData) => void;
  onDelete: (messageId: string) => void;
  onReact: (emoji: string, active: boolean) => void;
}) {
  const profile = useUserProfile(message.senderId);
  const { openProfileCard } = useMobileUI();
  const ref = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Hover reveals the reply/react/delete toolbar on desktop, but there's no
  // hover on touch - tapping anywhere on the row (bubbling up from any
  // child that doesn't stop it) toggles it instead, and toggles it back off
  // when that same tap lands on one of the toolbar's own buttons.
  const [actionsOpen, setActionsOpen] = useState(false);

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
      onClick={() => setActionsOpen((v) => !v)}
      className={clsx(
        "group relative flex gap-3 px-4 hover:bg-surface-2/50",
        grouped ? "py-0.5" : "py-1.5 mt-1.5 first:mt-0"
      )}
    >
      {grouped ? (
        <span className="w-9 shrink-0 pt-0.5 text-center text-[10px] text-muted opacity-0 group-hover:opacity-100">
          {time}
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openProfileCard(message.senderId);
          }}
          className="shrink-0 cursor-pointer"
          aria-label={`View ${name}'s profile`}
        >
          <Avatar name={name} src={profile?.avatarUrl} size={36} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {message.replyTo && <ReplyQuote replyTo={message.replyTo} />}
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openProfileCard(message.senderId);
              }}
              className={`cursor-pointer text-sm font-semibold hover:underline ${isOwn ? "text-accent" : ""}`}
            >
              {name}
            </button>
            <span className="text-[11px] text-muted">{time}</span>
          </div>
        )}
        {message.text && (
          <p className="whitespace-pre-wrap break-words text-sm">{linkifyText(message.text)}</p>
        )}
        {message.imageUrl && (
          <div className="relative mt-1 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="attachment"
              className="max-h-80 max-w-sm rounded-lg border border-border object-contain"
            />
            {GIF_URL_RE.test(message.imageUrl) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleGifFavorite?.();
                }}
                aria-label={isGifFavorite ? "Remove GIF from favorites" : "Favorite this GIF"}
                className={clsx(
                  "absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white transition-opacity cursor-pointer",
                  isGifFavorite || actionsOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Star size={14} className={isGifFavorite ? "fill-yellow-400 text-yellow-400" : ""} />
              </button>
            )}
          </div>
        )}
        {message.videoUrl && (
          <video
            src={message.videoUrl}
            controls
            className="mt-1 max-h-80 max-w-sm rounded-lg border border-border"
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
          pickerOpen || actionsOpen ? "flex" : "hidden group-hover:flex"
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
