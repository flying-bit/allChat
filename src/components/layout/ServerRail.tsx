"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Users, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { useUserServers } from "@/lib/hooks/useUserServers";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CreateServerModal } from "@/components/servers/CreateServerModal";
import { JoinServerModal } from "@/components/servers/JoinServerModal";
import { useMobileUI } from "@/lib/mobile-ui-context";

export function ServerRail() {
  const { user, profile, logout } = useAuth();
  const servers = useUserServers(user?.uid);
  const pathname = usePathname();
  const { openUserSettings } = useMobileUI();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const activeServerId = pathname.match(/\/app\/servers\/([^/]+)/)?.[1];
  const isFriendsActive = pathname.startsWith("/app/friends") || pathname.startsWith("/app/dm");

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 border-r border-border bg-surface-2 py-3">
      <Link
        href="/app/friends"
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${
          isFriendsActive
            ? "rounded-xl bg-accent text-accent-foreground"
            : "bg-surface text-foreground hover:rounded-xl hover:bg-accent hover:text-accent-foreground"
        }`}
        title="Arkadaşlar ve DM'ler"
      >
        <Users size={22} />
      </Link>

      <div className="my-1 h-px w-8 bg-border" />

      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {servers.map((server) => (
          <motion.div key={server.id} layout>
            <Link
              href={`/app/servers/${server.id}/channels/${server.defaultChannelId}`}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-200 ${
                activeServerId === server.id
                  ? "rounded-xl bg-accent text-accent-foreground"
                  : "bg-surface text-foreground hover:rounded-xl hover:bg-accent hover:text-accent-foreground"
              }`}
              title={server.name}
            >
              {server.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={server.iconUrl}
                  alt={server.name}
                  className="h-full w-full rounded-[inherit] object-cover"
                />
              ) : (
                server.name.slice(0, 2).toUpperCase()
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowAddMenu((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-accent hover:rounded-xl hover:bg-accent hover:text-accent-foreground cursor-pointer"
          title="Sunucu ekle"
        >
          <Plus size={22} />
        </button>
        {showAddMenu && (
          <div className="absolute bottom-0 left-16 z-10 w-44 rounded-lg border border-border bg-surface p-1 shadow-lg">
            <button
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer"
              onClick={() => {
                setShowCreate(true);
                setShowAddMenu(false);
              }}
            >
              Sunucu oluştur
            </button>
            <button
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer"
              onClick={() => {
                setShowJoin(true);
                setShowAddMenu(false);
              }}
            >
              Davetle katıl
            </button>
          </div>
        )}
      </div>

      <ThemeToggle />

      <button
        onClick={() => logout()}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger cursor-pointer"
        title="Çıkış yap"
      >
        <LogOut size={18} />
      </button>

      {profile && (
        <button
          onClick={openUserSettings}
          className="cursor-pointer rounded-full"
          title="Kullanıcı ayarları"
        >
          <Avatar name={profile.username} src={profile.avatarUrl} size={36} />
        </button>
      )}

      <CreateServerModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinServerModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  );
}
