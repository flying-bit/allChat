"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
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
    <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <Avatar name={name} src={profile?.avatarUrl} size={32} />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex gap-1">
        <button
          onClick={onAccept}
          className="rounded-md bg-accent p-1.5 text-accent-foreground hover:brightness-95 cursor-pointer"
          title="Accept"
        >
          <Check size={16} />
        </button>
        <button
          onClick={onDecline}
          className="rounded-md bg-surface p-1.5 text-muted hover:text-danger cursor-pointer"
          title="Decline"
        >
          <X size={16} />
        </button>
      </div>
    </div>
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
        {requests.map((r) => (
          <RequestRow
            key={r.fromUid}
            fromUid={r.fromUid}
            fallbackName={r.fromUsername ?? "?"}
            onAccept={() => user && acceptFriendRequest(user.uid, r.fromUid)}
            onDecline={() => user && declineFriendRequest(user.uid, r.fromUid)}
          />
        ))}
      </div>
    </div>
  );
}
