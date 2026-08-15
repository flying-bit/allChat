"use client";

import { motion, AnimatePresence } from "motion/react";
import { Phone, PhoneOff } from "lucide-react";
import { useDmCall } from "@/lib/dm-call-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Avatar } from "@/components/ui/Avatar";

// Shown app-wide (mounted once in the /app layout) whenever someone is
// calling - regardless of which page the user is currently looking at, the
// same way a phone call rings no matter what app is in the foreground.
export function IncomingCallBanner() {
  const { incomingCall, acceptCall, declineCall } = useDmCall();
  const profile = useUserProfile(incomingCall?.callerId);

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
          className="fixed left-1/2 top-4 z-50 flex w-full max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-xl"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Avatar name={profile?.username ?? "..."} src={profile?.avatarUrl} size={44} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.username ?? "..."}</p>
            <p className="text-xs text-muted">Sizi arıyor...</p>
          </div>
          <button
            type="button"
            onClick={declineCall}
            aria-label="Decline call"
            className="flex shrink-0 items-center justify-center rounded-full bg-danger p-2.5 text-white cursor-pointer hover:brightness-95"
          >
            <PhoneOff size={16} />
          </button>
          <button
            type="button"
            onClick={() => void acceptCall()}
            aria-label="Accept call"
            className="flex shrink-0 items-center justify-center rounded-full bg-[var(--online)] p-2.5 text-white cursor-pointer hover:brightness-95"
          >
            <Phone size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
