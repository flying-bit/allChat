"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenUserDms } from "@/lib/db";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Avatar } from "@/components/ui/Avatar";
import type { DmThreadMeta } from "@/types";

function DmRow({ otherUid, active }: { otherUid: string; active: boolean }) {
  const profile = useUserProfile(otherUid);
  if (!profile) return null;
  return (
    <Link
      href={`/app/dm/${otherUid}`}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Avatar name={profile.username} size={28} />
      <span className="truncate">{profile.username}</span>
    </Link>
  );
}

export function DmSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [dms, setDms] = useState<DmThreadMeta[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenUserDms(user.uid, setDms);
  }, [user]);

  const activeUid = pathname.match(/\/app\/dm\/([^/]+)/)?.[1];

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center border-b border-border px-4">
        <h2 className="font-semibold">Doğrudan Mesajlar</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <Link
          href="/app/friends"
          className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            pathname === "/app/friends"
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          <Users size={18} />
          Arkadaşlar
        </Link>
        <div className="my-2 h-px bg-border" />
        {dms.map((dm) => (
          <DmRow key={dm.otherUid} otherUid={dm.otherUid} active={activeUid === dm.otherUid} />
        ))}
      </div>
    </div>
  );
}
