"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useMobileUI } from "@/lib/mobile-ui-context";
import { updateUsername, updateUserAvatar } from "@/lib/db";

export function UserSettingsModal() {
  const { user, profile } = useAuth();
  const { userSettingsOpen: open, closeUserSettings: onClose } = useMobileUI();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the form fields whenever the modal transitions to open (see the
  // matching comment in ServerSettingsModal for why this runs during
  // render rather than in a useEffect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && profile) {
      setUsername(profile.username);
      setAvatarPreview(null);
      setAvatarFile(null);
      setError(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (avatarFile) {
        // Fire-and-forget so a slow/failing upload doesn't leave the
        // user stuck on a spinner - the username change already saved.
        void updateUserAvatar(user.uid, avatarFile).catch(() => {});
      }
      const trimmed = username.trim();
      if (trimmed && trimmed !== profile.username) {
        await updateUsername(user.uid, profile.usernameLower, trimmed);
      }
      setAvatarFile(null);
      setAvatarPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save, try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <Modal open={open} onClose={onClose} title="User settings">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer rounded-full"
            title="Change your avatar"
          >
            <Avatar name={profile.username} src={avatarPreview ?? profile.avatarUrl} size={64} />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <ImagePlus size={20} className="text-white" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Input
            id="user-settings-username"
            label="Username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted">{profile.email}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-accent">Saved!</p>}
        <Button type="submit" loading={saving} className="w-full">
          Save
        </Button>
      </form>
    </Modal>
  );
}
