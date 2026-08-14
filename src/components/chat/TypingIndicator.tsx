"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { listenTyping } from "@/lib/db";

function Dots() {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-muted"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function label(names: string[]) {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
  return "Several people are typing";
}

export function TypingIndicator({
  threadId,
  currentUid,
}: {
  threadId: string;
  currentUid: string;
}) {
  const [typing, setTyping] = useState<{ uid: string; username: string }[]>([]);

  useEffect(() => listenTyping(threadId, setTyping), [threadId]);

  const others = typing.filter((t) => t.uid !== currentUid);
  if (others.length === 0) return <div className="h-6" />;

  return (
    <div className="flex h-6 items-center gap-2 px-4 text-xs text-muted">
      <Dots />
      <span className="truncate italic">{label(others.map((t) => t.username))}</span>
    </div>
  );
}
