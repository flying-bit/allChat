"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { updateServerName, updateServerIcon, deleteServer } from "@/lib/db";
import type { ChannelData, ServerData } from "@/types";

export function ServerSettingsModal({
  open,
  onClose,
  server,
  channels,
}: {
  open: boolean;
  onClose: () => void;
  server: ServerData;
  channels: ChannelData[];
}) {
  const router = useRouter();
  const [name, setName] = useState(server.name);
  const [preview, setPreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      setConfirmingDelete(false);
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

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteServer(
        server.ownerId,
        server.id,
        server.inviteCode,
        channels.map((c) => c.id)
      );
      onClose();
      router.push("/app/friends");
    } catch {
      setError("Couldn't delete the server, try again.");
      setDeleting(false);
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

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">
          Danger zone
        </h3>
        {!confirmingDelete ? (
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={16} /> Delete server
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3">
            <p className="text-sm">
              Permanently delete <strong>{server.name}</strong>? All of its channels and
              messages will be gone for everyone. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={handleDelete}
                loading={deleting}
              >
                Delete forever
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
