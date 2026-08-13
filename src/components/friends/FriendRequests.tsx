"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { acceptFriendRequest, declineFriendRequest, listenIncomingFriendRequests } from "@/lib/db";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendRequestData } from "@/types";

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
      <h3 className="mb-2 font-semibold">Gelen İstekler ({requests.length})</h3>
      <div className="flex flex-col gap-2">
        {requests.map((r) => (
          <div
            key={r.fromUid}
            className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Avatar name={r.fromUsername ?? "?"} size={32} />
              <span className="text-sm font-medium">{r.fromUsername}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => user && acceptFriendRequest(user.uid, r.fromUid)}
                className="rounded-md bg-accent p-1.5 text-accent-foreground hover:brightness-95 cursor-pointer"
                title="Kabul et"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => user && declineFriendRequest(user.uid, r.fromUid)}
                className="rounded-md bg-surface p-1.5 text-muted hover:text-danger cursor-pointer"
                title="Reddet"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
