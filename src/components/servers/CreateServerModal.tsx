"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { createServer, updateServerIcon } from "@/lib/db";

export function CreateServerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function reset() {
    setName("");
    setIconFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { serverId, textChannelId } = await createServer(user.uid, name.trim());
      if (iconFile) {
        // The server itself is already created, so a failing logo upload
        // shouldn't block navigation into the new server - but it also
        // shouldn't fail silently, so surface it once it settles.
        void updateServerIcon(serverId, iconFile).catch(() => {
          alert(
            "The server was created, but the logo upload failed. Make sure Firebase Storage is enabled for your project."
          );
        });
      }
      reset();
      onClose();
      router.push(`/app/servers/${serverId}/channels/${textChannelId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the server, try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a server">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2"
            title="Choose a logo (optional)"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus size={20} className="text-muted" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Input
            id="server-name"
            label="Server name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Create
        </Button>
      </form>
    </Modal>
  );
}
