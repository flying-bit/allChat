"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { createServer } from "@/lib/db";

export function CreateServerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { serverId, textChannelId } = await createServer(user.uid, name.trim());
      setName("");
      onClose();
      router.push(`/app/servers/${serverId}/channels/${textChannelId}`);
    } catch {
      setError("Sunucu oluşturulamadı, tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sunucu oluştur">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="server-name"
          label="Sunucu adı"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Oluştur
        </Button>
      </form>
    </Modal>
  );
}
