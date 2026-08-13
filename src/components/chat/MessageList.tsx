"use client";

import { useEffect, useRef } from "react";
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

  // Re-scroll to the bottom whenever the content's height changes - not
  // just when a message is added, but also when a pasted image finishes
  // loading and pushes the layout taller. Keeps the view pinned to the
  // latest message at all times.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

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
