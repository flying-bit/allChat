"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { Avatar } from "@/components/ui/Avatar";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import type { MessageData } from "@/types";

export function MessageBubble({ message, isOwn }: { message: MessageData; isOwn: boolean }) {
  const profile = useUserProfile(message.senderId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 220,
      ease: "outQuad",
    });
  }, []);

  const name = profile?.username ?? "...";
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div ref={ref} className="flex gap-3 px-4 py-1.5 hover:bg-surface-2/50">
      <Avatar name={name} src={profile?.avatarUrl} size={36} />
      <div className="min-w-0">
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
      </div>
    </div>
  );
}
