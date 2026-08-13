"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { updateServerName, updateServerIcon } from "@/lib/db";
import type { ServerData } from "@/types";

export function ServerSettingsModal({
  open,
  onClose,
  server,
}: {
  open: boolean;
  onClose: () => void;
  server: ServerData;
}) {
  const [name, setName] = useState(server.name);
  const [preview, setPreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the form fields whenever the modal transitions to open, so a
  // stale value from a previous open (or a name change made elsewhere)
  // doesn't linger. Adjusting state during render (React's recommended
  // pattern for this) avoids the extra commit a useEffect would cause.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(server.name);
      setPreview(null);
      setIconFile(null);
      setError(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (name.trim() && name.trim() !== server.name) {
        await updateServerName(server.id, name.trim());
      }
      if (iconFile) {
        try {
          await updateServerIcon(server.id, iconFile);
        } catch {
          setError(
            "Name saved, but the logo upload failed. Make sure Firebase Storage is enabled for your project."
          );
          return; // keep the modal open so the message is visible
        }
      }
      onClose();
    } catch {
      setError("Couldn't save, try again.");
    } finally {
      setSaving(false);
    }
  }

  const iconSrc = preview ?? server.iconUrl;

  return (
    <Modal open={open} onClose={onClose} title="Server settings">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2"
            title="Change the logo"
          >
            {iconSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconSrc} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-muted">
                {name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
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
            id="server-settings-name"
            label="Server name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={saving} className="w-full">
          Save
        </Button>
      </form>
    </Modal>
  );
}
