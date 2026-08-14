"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, UserMinus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { listenFriends, listenStatus, removeFriend } from "@/lib/db";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Avatar } from "@/components/ui/Avatar";
import type { StatusInfo } from "@/types";

function FriendRow({ uid }: { uid: string }) {
  const { user } = useAuth();
  const profile = useUserProfile(uid);
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => listenStatus(uid, setStatus), [uid]);

  if (!profile) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}
      className="flex items-center justify-between overflow-hidden rounded-lg px-3 py-2 hover:bg-surface-2"
    >
      <div className="flex items-center gap-3">
        <Avatar name={profile.username} src={profile.avatarUrl} size={36} online={status?.online} />
        <div>
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs text-muted">{status?.online ? "Online" : "Offline"}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Link
            href={`/app/dm/${uid}`}
            className="block rounded-md p-2 text-muted hover:bg-surface hover:text-accent cursor-pointer"
            title="Send a message"
          >
            <MessageCircle size={18} />
          </Link>
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => user && removeFriend(user.uid, uid)}
          className="rounded-md p-2 text-muted hover:bg-surface hover:text-danger cursor-pointer"
          title="Remove friend"
        >
          <UserMinus size={18} />
        </motion.button>
      </div>
    </motion.div>
  );
}

export function FriendList() {
  const { user } = useAuth();
  const [friendUids, setFriendUids] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenFriends(user.uid, setFriendUids);
  }, [user]);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 font-semibold">Friends ({friendUids.length})</h3>
      {friendUids.length === 0 ? (
        <p className="text-sm text-muted">No friends yet. Add someone above!</p>
      ) : (
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {friendUids.map((uid) => (
              <FriendRow key={uid} uid={uid} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
