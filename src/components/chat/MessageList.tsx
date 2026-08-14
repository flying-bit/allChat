"use client";

import { useCallback, useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { MessageData } from "@/types";

export function MessageList({
  messages,
  currentUid,
}: {
  messages: MessageData[];
  currentUid: string;
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
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} isOwn={m.senderId === currentUid} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
