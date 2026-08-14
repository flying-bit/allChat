"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, UserPlus, X } from "lucide-react";
import { useAuth } from "./auth-context";
import {
  getUserProfile,
  listenChannelLastMessageAt,
  listenIncomingFriendRequests,
  listenServerChannels,
  listenUserDms,
  listenUserReads,
  listenUserServerIds,
} from "./db";
import type { ChannelData, DmThreadMeta } from "@/types";

interface ToastItem {
  id: string;
  icon: "dm" | "friend";
  title: string;
  body: string;
  href: string;
}

interface NotificationContextValue {
  unreadDmUids: Set<string>;
  unreadChannelIds: Set<string>;
  unreadServerIds: Set<string>;
  friendRequestCount: number;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function fireBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;
  try {
    new Notification(title, { body });
  } catch {
    // Some browsers (mobile Safari, etc.) may reject this - toasts still cover it.
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dms, setDms] = useState<DmThreadMeta[]>([]);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [reads, setReads] = useState<{ channels: Record<string, number>; dms: Record<string, number> }>({
    channels: {},
    dms: {},
  });
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [channelsByServer, setChannelsByServer] = useState<Record<string, ChannelData[]>>({});
  const [channelLastMessage, setChannelLastMessage] = useState<Record<string, number>>({});

  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const usernameCacheRef = useRef<Map<string, string>>(new Map());
  async function resolveUsername(uid: string) {
    const cached = usernameCacheRef.current.get(uid);
    if (cached) return cached;
    const profile = await getUserProfile(uid);
    const name = profile?.username ?? "Someone";
    usernameCacheRef.current.set(uid, name);
    return name;
  }

  function pushToast(icon: ToastItem["icon"], title: string, body: string, href: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-3), { id, icon, title, body, href }]);
    window.setTimeout(() => dismissToast(id), 6000);
    fireBrowserNotification(title, body);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    if (user) requestBrowserNotificationPermission();
  }, [user]);

  // Direct messages: mirror thread metadata for unread badges, and toast
  // when a *new* incoming message arrives for a thread the user isn't
  // currently looking at. `dmSeenRef` starts null so the initial snapshot
  // (existing history) never fires a toast burst on load.
  const dmSeenRef = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    dmSeenRef.current = null;
    if (!user) return;
    return listenUserDms(user.uid, (list) => {
      setDms(list);
      const seen = dmSeenRef.current;
      for (const dm of list) {
        const prevAt = seen?.get(dm.otherUid) ?? 0;
        const isNew = seen != null && dm.lastMessageAt > prevAt;
        if (isNew && dm.lastSenderId && dm.lastSenderId !== user.uid) {
          const activeUid = pathRef.current.match(/\/app\/dm\/([^/]+)/)?.[1];
          if (activeUid !== dm.otherUid) {
            void resolveUsername(dm.otherUid).then((name) =>
              pushToast("dm", name, "Sent you a new message", `/app/dm/${dm.otherUid}`)
            );
          }
        }
      }
      dmSeenRef.current = new Map(list.map((d) => [d.otherUid, d.lastMessageAt]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Friend requests: toast whenever a new incoming request shows up.
  const friendSeenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    friendSeenRef.current = null;
    if (!user) return;
    return listenIncomingFriendRequests(user.uid, (reqs) => {
      setFriendRequestCount(reqs.length);
      const seen = friendSeenRef.current;
      if (seen) {
        for (const r of reqs) {
          if (!seen.has(r.fromUid)) {
            pushToast(
              "friend",
              r.fromUsername ?? "New friend request",
              "Sent you a friend request",
              "/app/friends"
            );
          }
        }
      }
      friendSeenRef.current = new Set(reqs.map((r) => r.fromUid));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return listenUserReads(user.uid, setReads);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return listenUserServerIds(user.uid, setServerIds);
  }, [user]);

  useEffect(() => {
    const unsubs = serverIds.map((sid) =>
      listenServerChannels(sid, (channels) => {
        setChannelsByServer((prev) => ({ ...prev, [sid]: channels }));
      })
    );
    return () => {
      unsubs.forEach((u) => u());
      setChannelsByServer((prev) => {
        const next: Record<string, ChannelData[]> = {};
        for (const sid of serverIds) if (prev[sid]) next[sid] = prev[sid];
        return next;
      });
    };
  }, [serverIds]);

  const channelServerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [sid, channels] of Object.entries(channelsByServer)) {
      for (const c of channels) if (c.type === "text") map[c.id] = sid;
    }
    return map;
  }, [channelsByServer]);

  const textChannelIds = useMemo(() => Object.keys(channelServerMap).sort(), [channelServerMap]);

  useEffect(() => {
    const unsubs = textChannelIds.map((cid) =>
      listenChannelLastMessageAt(cid, (at) => {
        setChannelLastMessage((prev) => (prev[cid] === at ? prev : { ...prev, [cid]: at }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [textChannelIds]);

  const unreadDmUids = useMemo(() => {
    const set = new Set<string>();
    for (const dm of dms) {
      const readAt = reads.dms[dm.otherUid] ?? 0;
      if (dm.lastMessageAt > readAt && dm.lastSenderId !== user?.uid) set.add(dm.otherUid);
    }
    return set;
  }, [dms, reads, user]);

  const unreadChannelIds = useMemo(() => {
    const set = new Set<string>();
    for (const [cid, at] of Object.entries(channelLastMessage)) {
      const readAt = reads.channels[cid] ?? 0;
      if (at > 0 && at > readAt) set.add(cid);
    }
    return set;
  }, [channelLastMessage, reads]);

  const unreadServerIds = useMemo(() => {
    const set = new Set<string>();
    for (const cid of unreadChannelIds) {
      const sid = channelServerMap[cid];
      if (sid) set.add(sid);
    }
    return set;
  }, [unreadChannelIds, channelServerMap]);

  const value: NotificationContextValue = {
    unreadDmUids,
    unreadChannelIds,
    unreadServerIds,
    friendRequestCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}
              onClick={() => {
                dismissToast(t.id);
                router.push(t.href);
              }}
              className="pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left shadow-xl"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                {t.icon === "friend" ? <UserPlus size={16} /> : <MessageCircle size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{t.title}</span>
                <span className="block truncate text-xs text-muted">{t.body}</span>
              </span>
              <span
                role="button"
                aria-label="Dismiss"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(t.id);
                }}
                className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <X size={14} />
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
