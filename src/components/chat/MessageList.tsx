"use client";

import { useCallback, useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { MessageData, ReactionMap } from "@/types";

export function MessageList({
  messages,
  currentUid,
  reactions,
  onReply,
  onDelete,
  onReact,
}: {
  messages: MessageData[];
  currentUid: string;
  reactions: Record<string, ReactionMap>;
  onReply: (message: MessageData) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string, active: boolean) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  // Jump to the newest message the instant the message list itself
  // changes - new message, channel switch, initial load - instead of
  // waiting for a layout resize to catch up. Keeps the latest message
  // visible at all times.
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Also re-pin to the bottom when the content's height changes after
  // that, e.g. a pasted image finishing its load and pushing the layout
  // taller.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(scrollToBottom);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-2">
      <div ref={contentRef}>
        {messages.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No messages yet. Send the first one!
          </p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          // Consecutive messages from the same sender collapse into one
          // group - only the first keeps the avatar/name/timestamp header,
          // so a burst of messages doesn't repeat "our name" on every line.
          // A reply always starts a fresh group since it quotes someone.
          const grouped = Boolean(
            prev &&
              prev.senderId === m.senderId &&
              !m.replyTo &&
              m.createdAt - prev.createdAt < 5 * 60 * 1000
          );
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={m.senderId === currentUid}
              currentUid={currentUid}
              reactions={reactions[m.id]}
              grouped={grouped}
              onReply={onReply}
              onDelete={onDelete}
              onReact={(emoji, active) => onReact(m.id, emoji, active)}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
