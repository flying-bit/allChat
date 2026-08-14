"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Users, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { useUserServers } from "@/lib/hooks/useUserServers";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CreateServerModal } from "@/components/servers/CreateServerModal";
import { JoinServerModal } from "@/components/servers/JoinServerModal";
import { useMobileUI } from "@/lib/mobile-ui-context";
import { useNotifications } from "@/lib/notifications-context";

const tap = { scale: 0.92 };
const hover = { scale: 1.06 };

export function ServerRail() {
  const { user, profile, logout } = useAuth();
  const servers = useUserServers(user?.uid);
  const pathname = usePathname();
  const { openUserSettings } = useMobileUI();
  const { unreadServerIds, unreadDmUids, friendRequestCount } = useNotifications();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const activeServerId = pathname.match(/\/app\/servers\/([^/]+)/)?.[1];
  const isFriendsActive = pathname.startsWith("/app/friends") || pathname.startsWith("/app/dm");

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 border-r border-border bg-surface-3 py-3">
      <motion.div
        className="relative"
        whileHover={hover}
        whileTap={tap}
        transition={{ type: "spring", duration: 0.3, bounce: 0.5 }}
      >
        <Link
          href="/app/friends"
          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${
            isFriendsActive
              ? "rounded-xl bg-accent text-accent-foreground"
              : "bg-surface text-foreground hover:rounded-xl hover:bg-accent hover:text-accent-foreground"
          }`}
          title="Friends & DMs"
        >
          <Users size={22} />
        </Link>
        {!isFriendsActive && (unreadDmUids.size > 0 || friendRequestCount > 0) && (
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-3 bg-danger" />
        )}
      </motion.div>

      <div className="my-1 h-px w-8 bg-border" />

      <div className="min-h-0 flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {servers.map((server) => (
            <motion.div
              key={server.id}
              layout
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={hover}
              whileTap={tap}
              transition={{ type: "spring", duration: 0.35, bounce: 0.5 }}
            >
              <div className="relative">
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
                {activeServerId !== server.id && unreadServerIds.has(server.id) && (
                  <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-3 bg-danger" />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="relative">
        <motion.button
          whileHover={hover}
          whileTap={tap}
          transition={{ type: "spring", duration: 0.3, bounce: 0.5 }}
          onClick={() => setShowAddMenu((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-accent hover:rounded-xl hover:bg-accent hover:text-accent-foreground cursor-pointer"
          title="Add a server"
        >
          <Plus size={22} />
        </motion.button>
        <AnimatePresence>
          {showAddMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -8 }}
              transition={{ type: "spring", duration: 0.25, bounce: 0.3 }}
              className="absolute bottom-0 left-16 z-10 w-44 rounded-lg border border-border bg-surface p-1 shadow-lg"
            >
              <button
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer"
                onClick={() => {
                  setShowCreate(true);
                  setShowAddMenu(false);
                }}
              >
                Create a server
              </button>
              <button
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer"
                onClick={() => {
                  setShowJoin(true);
                  setShowAddMenu(false);
                }}
              >
                Join with an invite
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ThemeToggle />

      <motion.button
        whileHover={hover}
        whileTap={tap}
        transition={{ type: "spring", duration: 0.3, bounce: 0.5 }}
        onClick={() => logout()}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger cursor-pointer"
        title="Log out"
      >
        <LogOut size={18} />
      </motion.button>

      {profile && (
        <motion.button
          whileHover={hover}
          whileTap={tap}
          transition={{ type: "spring", duration: 0.3, bounce: 0.5 }}
          onClick={openUserSettings}
          className="cursor-pointer rounded-full"
          title="User settings"
        >
          <Avatar name={profile.username} src={profile.avatarUrl} size={36} />
        </motion.button>
      )}

      <CreateServerModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinServerModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  );
}
