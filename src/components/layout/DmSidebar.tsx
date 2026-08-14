"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenUserDms } from "@/lib/db";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useNotifications } from "@/lib/notifications-context";
import { Avatar } from "@/components/ui/Avatar";
import { useMobileUI } from "@/lib/mobile-ui-context";
import type { DmThreadMeta } from "@/types";

function DmRow({
  otherUid,
  active,
  unread,
  onNavigate,
}: {
  otherUid: string;
  active: boolean;
  unread: boolean;
  onNavigate: () => void;
}) {
  const profile = useUserProfile(otherUid);
  if (!profile) return null;
  return (
    <Link
      href={`/app/dm/${otherUid}`}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Avatar name={profile.username} src={profile.avatarUrl} size={28} />
      <span className={`truncate ${unread && !active ? "font-semibold text-foreground" : ""}`}>
        {profile.username}
      </span>
      {unread && !active && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-danger" />}
    </Link>
  );
}

export function DmSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { channelDrawerOpen, closeChannelDrawer } = useMobileUI();
  const { unreadDmUids, friendRequestCount } = useNotifications();
  const [dms, setDms] = useState<DmThreadMeta[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenUserDms(user.uid, setDms);
  }, [user]);

  const activeUid = pathname.match(/\/app\/dm\/([^/]+)/)?.[1];

  return (
    <>
      {channelDrawerOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={closeChannelDrawer} />
      )}
      <div
        className={`fixed inset-y-0 left-[72px] z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          channelDrawerOpen ? "translate-x-0" : "-translate-x-[calc(100%+72px)]"
        } md:flex`}
      >
        <div className="flex h-14 items-center border-b border-border px-4">
          <h2 className="font-semibold">Direct Messages</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <Link
            href="/app/friends"
            onClick={closeChannelDrawer}
            className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              pathname === "/app/friends"
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Users size={18} />
            Friends
            {friendRequestCount > 0 && (
              <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {friendRequestCount}
              </span>
            )}
          </Link>
          <div className="my-2 h-px bg-border" />
          {dms.map((dm) => (
            <DmRow
              key={dm.otherUid}
              otherUid={dm.otherUid}
              active={activeUid === dm.otherUid}
              unread={unreadDmUids.has(dm.otherUid)}
              onNavigate={closeChannelDrawer}
            />
          ))}
        </div>
      </div>
    </>
  );
}
