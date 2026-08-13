"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import {
  Hash,
  Volume2,
  UserPlus,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listenServer,
  listenServerChannels,
  listenServerCategories,
  createChannel,
  createCategory,
} from "@/lib/db";
import type { ServerData, ChannelData, CategoryData } from "@/types";
import { InvitePanel } from "@/components/servers/InvitePanel";
import { ServerSettingsModal } from "@/components/servers/ServerSettingsModal";
import { Avatar } from "@/components/ui/Avatar";
import { useMobileUI } from "@/lib/mobile-ui-context";

function ChannelLink({
  serverId,
  channel,
  active,
  onNavigate,
}: {
  serverId: string;
  channel: ChannelData;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={`/app/servers/${serverId}/channels/${channel.id}`}
      onClick={onNavigate}
      className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      {channel.type === "voice" ? <Volume2 size={16} /> : <Hash size={16} />}
      <span className="truncate">{channel.name}</span>
    </Link>
  );
}

function AddChannelForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, type: "text" | "voice") => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim(), type);
    setName("");
    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 mb-2 flex flex-col gap-1 rounded-md border border-border p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="channel-name"
        className="rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
      />
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setType("text")}
          className={`flex-1 cursor-pointer rounded px-2 py-1 ${
            type === "text" ? "bg-accent text-accent-foreground" : "bg-surface-2"
          }`}
        >
          Text
        </button>
        <button
          type="button"
          onClick={() => setType("voice")}
          className={`flex-1 cursor-pointer rounded px-2 py-1 ${
            type === "voice" ? "bg-accent text-accent-foreground" : "bg-surface-2"
          }`}
        >
          Voice
        </button>
      </div>
      <div className="flex gap-1">
        <button
          type="submit"
          className="flex-1 cursor-pointer rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded px-2 py-1 text-xs text-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ChannelSidebar({ serverId }: { serverId: string }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const { channelDrawerOpen, closeChannelDrawer, openUserSettings } = useMobileUI();
  const [server, setServer] = useState<ServerData | null>(null);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingChannelFor, setAddingChannelFor] = useState<string | null>(null); // "uncategorized" | categoryId
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => listenServer(serverId, setServer), [serverId]);
  useEffect(() => listenServerChannels(serverId, setChannels), [serverId]);
  useEffect(() => listenServerCategories(serverId, setCategories), [serverId]);

  const activeChannelId = pathname.match(/\/channels\/([^/]+)/)?.[1];
  const isOwner = server?.ownerId === user?.uid;

  function toggleCollapse(categoryId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const categoryIds = new Set(categories.map((c) => c.id));
  const uncategorized = channels
    .filter((c) => !c.categoryId || !categoryIds.has(c.categoryId))
    .sort((a, b) => a.order - b.order);
  const grouped = categories.map((cat) => ({
    category: cat,
    items: channels.filter((c) => c.categoryId === cat.id).sort((a, b) => a.order - b.order),
  }));

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await createCategory(serverId, newCategoryName.trim(), categories.length);
    setNewCategoryName("");
    setAddingCategory(false);
  }

  if (!server) {
    return (
      <div className="hidden w-60 shrink-0 border-r border-border bg-surface md:block" />
    );
  }

  return (
    <>
      {channelDrawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeChannelDrawer}
        />
      )}
      <div
        className={`fixed inset-y-0 left-[72px] z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          channelDrawerOpen ? "translate-x-0" : "-translate-x-[calc(100%+72px)]"
        } md:flex`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            {server.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={server.iconUrl} alt={server.name} className="h-7 w-7 shrink-0 rounded-lg object-cover" />
            ) : null}
            <h2 className="truncate font-semibold">{server.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isOwner && (
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-accent cursor-pointer"
                title="Server settings"
              >
                <Settings size={18} />
              </button>
            )}
            <button
              onClick={() => setShowInvite(true)}
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-accent cursor-pointer"
              title="Invite people"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {uncategorized.map((c) => (
            <ChannelLink
              key={c.id}
              serverId={serverId}
              channel={c}
              active={activeChannelId === c.id}
              onNavigate={closeChannelDrawer}
            />
          ))}
          {isOwner &&
            (addingChannelFor === "uncategorized" ? (
              <AddChannelForm
                onCancel={() => setAddingChannelFor(null)}
                onSubmit={(name, type) => createChannel(serverId, name, type, channels.length).then(() => {})}
              />
            ) : (
              <button
                onClick={() => setAddingChannelFor("uncategorized")}
                className="mt-1 mb-2 flex w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <Plus size={14} /> Add channel
              </button>
            ))}

          {grouped.map(({ category, items }) => {
            const isCollapsed = collapsed.has(category.id);
            return (
              <div key={category.id} className="mt-2">
                <div className="flex items-center justify-between px-1 py-1">
                  <button
                    onClick={() => toggleCollapse(category.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className="truncate">{category.name}</span>
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => setAddingChannelFor(category.id)}
                      className="cursor-pointer rounded p-0.5 text-muted hover:text-accent"
                      title="Add a channel to this category"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="mt-0.5">
                    {items.map((c) => (
                      <ChannelLink
                        key={c.id}
                        serverId={serverId}
                        channel={c}
                        active={activeChannelId === c.id}
                        onNavigate={closeChannelDrawer}
                      />
                    ))}
                    {isOwner && addingChannelFor === category.id && (
                      <AddChannelForm
                        onCancel={() => setAddingChannelFor(null)}
                        onSubmit={(name, type) =>
                          createChannel(serverId, name, type, items.length, category.id).then(() => {})
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isOwner &&
            (addingCategory ? (
              <form onSubmit={handleAddCategory} className="mt-2 flex flex-col gap-1 rounded-md border border-border p-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="CATEGORY NAME"
                  className="rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
                />
                <div className="flex gap-1">
                  <button
                    type="submit"
                    className="flex-1 cursor-pointer rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(false)}
                    className="cursor-pointer rounded px-2 py-1 text-xs text-muted hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingCategory(true)}
                className="mt-2 flex w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <Plus size={14} /> Add category
              </button>
            ))}
        </div>
        {profile && (
          <button
            onClick={openUserSettings}
            className="flex cursor-pointer items-center gap-2 border-t border-border p-2 text-left hover:bg-surface-2"
          >
            <Avatar name={profile.username} src={profile.avatarUrl} size={32} />
            <span className="truncate text-sm font-medium">{profile.username}</span>
          </button>
        )}
        <InvitePanel
          open={showInvite}
          onClose={() => setShowInvite(false)}
          serverId={serverId}
          inviteCode={server.inviteCode}
          isOwner={isOwner}
        />
        <ServerSettingsModal open={showSettings} onClose={() => setShowSettings(false)} server={server} />
      </div>
    </>
  );
}
