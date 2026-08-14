"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { acceptFriendRequest, declineFriendRequest, listenIncomingFriendRequests } from "@/lib/db";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendRequestData } from "@/types";

function RequestRow({
  fromUid,
  fallbackName,
  onAccept,
  onDecline,
}: {
  fromUid: string;
  fallbackName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const profile = useUserProfile(fromUid);
  const name = profile?.username ?? fallbackName;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}
      className="flex items-center justify-between overflow-hidden rounded-lg bg-surface-2 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <Avatar name={name} src={profile?.avatarUrl} size={32} />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex gap-1">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onAccept}
          className="rounded-md bg-accent p-1.5 text-accent-foreground hover:brightness-95 cursor-pointer"
          title="Accept"
        >
          <Check size={16} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onDecline}
          className="rounded-md bg-surface p-1.5 text-muted hover:text-danger cursor-pointer"
          title="Decline"
        >
          <X size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
}

export function FriendRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<(FriendRequestData & { fromUid: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenIncomingFriendRequests(user.uid, setRequests);
  }, [user]);

  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 font-semibold">Incoming Requests ({requests.length})</h3>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {requests.map((r) => (
            <RequestRow
              key={r.fromUid}
              fromUid={r.fromUid}
              fallbackName={r.fromUsername ?? "?"}
              onAccept={() => user && acceptFriendRequest(user.uid, r.fromUid)}
              onDecline={() => user && declineFriendRequest(user.uid, r.fromUid)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
