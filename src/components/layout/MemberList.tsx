"use client";

import { useEffect, useState } from "react";
import { listenServerMemberIds, listenStatus } from "@/lib/db";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Avatar } from "@/components/ui/Avatar";
import { useMobileUI } from "@/lib/mobile-ui-context";
import type { StatusInfo } from "@/types";

function MemberRow({ uid }: { uid: string }) {
  const profile = useUserProfile(uid);
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => listenStatus(uid, setStatus), [uid]);

  if (!profile) return null;

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
      <Avatar name={profile.username} src={profile.avatarUrl} size={28} online={status?.online} />
      <span className="truncate text-foreground">{profile.username}</span>
    </div>
  );
}

export function MemberList({ serverId }: { serverId: string }) {
  const { memberListOpen, closeMemberList } = useMobileUI();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => listenServerMemberIds(serverId, setMemberIds), [serverId]);

  useEffect(() => {
    const unsubs = memberIds.map((uid) =>
      listenStatus(uid, (s) => {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          if (s?.online) next.add(uid);
          else next.delete(uid);
          return next;
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [memberIds]);

  const online = memberIds.filter((uid) => onlineIds.has(uid));
  const offline = memberIds.filter((uid) => !onlineIds.has(uid));

  return (
    <>
      {memberListOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={closeMemberList} />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-40 w-60 overflow-y-auto border-l border-border bg-surface p-2 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:flex lg:shrink-0 lg:flex-col ${
          memberListOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {online.length > 0 && (
          <div className="mb-1 px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Çevrimiçi — {online.length}
          </div>
        )}
        {online.map((uid) => (
          <MemberRow key={uid} uid={uid} />
        ))}
        {offline.length > 0 && (
          <div className="mb-1 mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Çevrimdışı — {offline.length}
          </div>
        )}
        {offline.map((uid) => (
          <MemberRow key={uid} uid={uid} />
        ))}
      </div>
    </>
  );
}
