"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
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
  query,
  onNavigate,
}: {
  otherUid: string;
  active: boolean;
  unread: boolean;
  query: string;
  onNavigate: () => void;
}) {
  const profile = useUserProfile(otherUid);
  // Each row resolves its own profile (same pattern as everywhere else in
  // this app - useUserProfile's other callers all do the same), so
  // filtering by username can't happen up in DmSidebar - it only has uids.
  // A row just hides itself when it doesn't match instead.
  if (!profile) return null;
  if (query && !profile.username.toLowerCase().includes(query)) return null;
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
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

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
        <div className="border-b border-border p-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5">
            <Search size={14} className="shrink-0 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search DMs..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
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
              query={query}
              onNavigate={closeChannelDrawer}
            />
          ))}
        </div>
      </div>
    </>
  );
}
