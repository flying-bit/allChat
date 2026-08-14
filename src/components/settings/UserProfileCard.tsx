"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useMobileUI } from "@/lib/mobile-ui-context";
import { listenStatus } from "@/lib/db";
import { gradientFor } from "@/lib/color";
import type { StatusInfo } from "@/types";

export function UserProfileCard() {
  const { user } = useAuth();
  const { profileCardUid, closeProfileCard, openUserSettings } = useMobileUI();
  const profile = useUserProfile(profileCardUid);
  const [status, setStatus] = useState<StatusInfo | null>(null);

  // Clear the stale status from a previously-viewed profile without a
  // setState-in-effect cascade - adjusting state during render (React's
  // recommended pattern, also used in ServerSettingsModal/ChannelPage) so
  // the reset lands before the child re-render that would show it.
  const [statusUid, setStatusUid] = useState(profileCardUid);
  if (profileCardUid !== statusUid) {
    setStatusUid(profileCardUid);
    setStatus(null);
  }

  useEffect(() => {
    if (!profileCardUid) return;
    return listenStatus(profileCardUid, setStatus);
  }, [profileCardUid]);

  if (!profileCardUid || !profile) return null;
  const isSelf = user?.uid === profileCardUid;

  return (
    <Modal open onClose={closeProfileCard} title="">
      {/* Bleeds out of Modal's padding so the banner reaches the card's edges. */}
      <div className="-mx-6 -mt-6 mb-10">
        <div
          className="h-24 w-full"
          style={
            profile.bannerUrl
              ? { backgroundImage: `url(${profile.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: gradientFor(profile.username) }
          }
        />
        <div className="relative px-6">
          <div className="absolute -top-10 rounded-full border-4 border-surface bg-surface">
            <Avatar name={profile.username} src={profile.avatarUrl} size={72} online={status?.online} />
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{profile.username}</h3>
          <p className="text-xs text-muted">
            {status?.online ? "Online" : "Offline"} · Member since{" "}
            {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>
        {isSelf && (
          <Button
            variant="outline"
            className="shrink-0 !px-3 !py-1.5 text-xs"
            onClick={() => {
              closeProfileCard();
              openUserSettings();
            }}
          >
            <Pencil size={13} /> Edit
          </Button>
        )}
      </div>
    </Modal>
  );
}
