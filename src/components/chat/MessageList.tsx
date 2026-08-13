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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {messages.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Henüz mesaj yok. İlk mesajı sen gönder!
        </p>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} isOwn={m.senderId === currentUid} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
