"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, Sticker } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useMobileUI } from "@/lib/mobile-ui-context";
import { gradientFor } from "@/lib/color";
import { GifPicker } from "@/components/chat/GifPicker";
import {
  updateUsername,
  updateUserAvatar,
  updateUserAvatarFromGif,
  updateUserBanner,
  updateUserBannerFromGif,
} from "@/lib/db";

// Either a locally-picked file or a KLIPY GIF URL, not yet uploaded -
// mirrors MessageInput's PendingAttachment for the same reason (defer the
// actual upload to save time, so backing out costs nothing).
type PendingImage = { kind: "file"; file: File; previewUrl: string } | { kind: "gif"; sourceUrl: string; previewUrl: string };

export function UserSettingsModal() {
  const { user, profile } = useAuth();
  const { userSettingsOpen: open, closeUserSettings: onClose } = useMobileUI();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [pendingAvatar, setPendingAvatar] = useState<PendingImage | null>(null);
  const [pendingBanner, setPendingBanner] = useState<PendingImage | null>(null);
  const [gifTarget, setGifTarget] = useState<"avatar" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Reset the form fields whenever the modal transitions to open (see the
  // matching comment in ServerSettingsModal for why this runs during
  // render rather than in a useEffect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && profile) {
      setUsername(profile.username);
      setPendingAvatar(null);
      setPendingBanner(null);
      setError(null);
    }
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingAvatar({ kind: "file", file, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingBanner({ kind: "file", file, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (pendingAvatar) {
        // Kicked off without awaiting so a slow upload doesn't leave the
        // user stuck on a spinner while the username save (below) is
        // usually much faster - but we still report a failure when it
        // eventually happens instead of silently pretending it worked.
        const upload =
          pendingAvatar.kind === "file"
            ? updateUserAvatar(user.uid, pendingAvatar.file)
            : updateUserAvatarFromGif(user.uid, pendingAvatar.sourceUrl);
        void upload.catch(() => {
          setSaved(false);
          setError("Couldn't upload the avatar, try again.");
        });
      }
      if (pendingBanner) {
        const upload =
          pendingBanner.kind === "file"
            ? updateUserBanner(user.uid, pendingBanner.file)
            : updateUserBannerFromGif(user.uid, pendingBanner.sourceUrl);
        void upload.catch(() => {
          setSaved(false);
          setError("Couldn't upload the banner, try again.");
        });
      }
      const trimmed = username.trim();
      if (trimmed && trimmed !== profile.username) {
        await updateUsername(user.uid, profile.usernameLower, trimmed);
      }
      setPendingAvatar(null);
      setPendingBanner(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save, try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  const avatarPreview = pendingAvatar?.previewUrl ?? profile.avatarUrl;
  const bannerPreview = pendingBanner?.previewUrl ?? profile.bannerUrl;

  return (
    <Modal open={open} onClose={onClose} title="User settings">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            className="group relative block h-24 w-full cursor-pointer overflow-hidden rounded-xl border border-border"
            title="Change your banner"
          >
            <div
              className="h-full w-full"
              style={
                bannerPreview
                  ? { backgroundImage: `url(${bannerPreview})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: gradientFor(profile.username) }
              }
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <ImagePlus size={20} className="text-white" />
            </div>
            <div className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-foreground">
              <ImagePlus size={12} />
            </div>
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setGifTarget("banner")}
            className="mt-1 flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-accent"
          >
            <Sticker size={13} /> Or search an animated GIF banner
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="group relative cursor-pointer rounded-full"
            title="Change your avatar"
          >
            <Avatar name={profile.username} src={avatarPreview} size={64} />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <ImagePlus size={20} className="text-white" />
            </div>
            {/* Always-visible badge, not just the hover overlay above - there's
                no hover on touch devices, so without this the avatar looked
                purely decorative on mobile and the picker was undiscoverable. */}
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-foreground">
              <ImagePlus size={12} />
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
          <div className="flex-1">
            <Input
              id="user-settings-username"
              label="Username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setGifTarget("avatar")}
              className="mt-1 flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-accent"
            >
              <Sticker size={13} /> Or search an animated GIF avatar
            </button>
          </div>
        </div>
        <p className="text-xs text-muted">{profile.email}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-accent">Saved!</p>}
        <Button type="submit" loading={saving} className="w-full">
          Save
        </Button>
      </form>
      <GifPicker
        open={gifTarget !== null}
        onClose={() => setGifTarget(null)}
        onPick={(sourceUrl, previewUrl) => {
          if (gifTarget === "avatar") setPendingAvatar({ kind: "gif", sourceUrl, previewUrl });
          else if (gifTarget === "banner") setPendingBanner({ kind: "gif", sourceUrl, previewUrl });
          setGifTarget(null);
        }}
      />
    </Modal>
  );
}
