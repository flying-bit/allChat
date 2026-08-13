"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, UserMinus } from "lucide-react";
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
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-2">
      <div className="flex items-center gap-3">
        <Avatar name={profile.username} src={profile.avatarUrl} size={36} online={status?.online} />
        <div>
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs text-muted">{status?.online ? "Çevrimiçi" : "Çevrimdışı"}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <Link
          href={`/app/dm/${uid}`}
          className="rounded-md p-2 text-muted hover:bg-surface hover:text-accent cursor-pointer"
          title="Mesaj gönder"
        >
          <MessageCircle size={18} />
        </Link>
        <button
          onClick={() => user && removeFriend(user.uid, uid)}
          className="rounded-md p-2 text-muted hover:bg-surface hover:text-danger cursor-pointer"
          title="Arkadaşlıktan çıkar"
        >
          <UserMinus size={18} />
        </button>
      </div>
    </div>
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
      <h3 className="mb-2 font-semibold">Arkadaşlar ({friendUids.length})</h3>
      {friendUids.length === 0 ? (
        <p className="text-sm text-muted">Henüz arkadaşın yok. Yukarıdan birini ekle!</p>
      ) : (
        <div className="flex flex-col gap-1">
          {friendUids.map((uid) => (
            <FriendRow key={uid} uid={uid} />
          ))}
        </div>
      )}
    </div>
  );
}
