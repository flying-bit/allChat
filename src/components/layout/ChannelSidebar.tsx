"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Hash, Volume2, UserPlus, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenServer, listenServerChannels, createChannel } from "@/lib/db";
import type { ServerData, ChannelData } from "@/types";
import { InvitePanel } from "@/components/servers/InvitePanel";
import { Avatar } from "@/components/ui/Avatar";

export function ChannelSidebar({ serverId }: { serverId: string }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const [server, setServer] = useState<ServerData | null>(null);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");

  useEffect(() => listenServer(serverId, setServer), [serverId]);
  useEffect(() => listenServerChannels(serverId, setChannels), [serverId]);

  const activeChannelId = pathname.match(/\/channels\/([^/]+)/)?.[1];
  const isOwner = server?.ownerId === user?.uid;

  async function handleAddChannel(e: FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    await createChannel(serverId, newChannelName.trim(), newChannelType, channels.length);
    setNewChannelName("");
    setAddingChannel(false);
  }

  if (!server) return <div className="w-60 shrink-0 border-r border-border bg-surface" />;

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h2 className="truncate font-semibold">{server.name}</h2>
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-accent cursor-pointer"
          title="Davet et"
        >
          <UserPlus size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/app/servers/${serverId}/channels/${c.id}`}
            className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              activeChannelId === c.id
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {c.type === "voice" ? <Volume2 size={16} /> : <Hash size={16} />}
            <span className="truncate">{c.name}</span>
          </Link>
        ))}
        {isOwner &&
          (addingChannel ? (
            <form
              onSubmit={handleAddChannel}
              className="mt-2 flex flex-col gap-1 rounded-md border border-border p-2"
            >
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="kanal-adı"
                className="rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setNewChannelType("text")}
                  className={`flex-1 cursor-pointer rounded px-2 py-1 ${
                    newChannelType === "text" ? "bg-accent text-accent-foreground" : "bg-surface-2"
                  }`}
                >
                  Metin
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelType("voice")}
                  className={`flex-1 cursor-pointer rounded px-2 py-1 ${
                    newChannelType === "voice" ? "bg-accent text-accent-foreground" : "bg-surface-2"
                  }`}
                >
                  Ses
                </button>
              </div>
              <button
                type="submit"
                className="mt-1 cursor-pointer rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
              >
                Ekle
              </button>
            </form>
          ) : (
            <button
              onClick={() => setAddingChannel(true)}
              className="mt-1 flex w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <Plus size={14} /> Kanal ekle
            </button>
          ))}
      </div>
      {profile && (
        <div className="flex items-center gap-2 border-t border-border p-2">
          <Avatar name={profile.username} size={32} />
          <span className="truncate text-sm font-medium">{profile.username}</span>
        </div>
      )}
      <InvitePanel
        open={showInvite}
        onClose={() => setShowInvite(false)}
        serverId={serverId}
        inviteCode={server.inviteCode}
        isOwner={isOwner}
      />
    </div>
  );
}
