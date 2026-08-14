"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { joinServerByInviteCode, listenServerChannels } from "@/lib/db";

export function JoinServerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accepts either a bare code or a pasted invite link
  // (.../app/invite/{code}) and pulls out just the code either way.
  function extractCode(raw: string) {
    const trimmed = raw.trim();
    const match = trimmed.match(/\/invite\/([^/?#]+)/);
    return (match ? match[1] : trimmed).toUpperCase();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinServerByInviteCode(user.uid, extractCode(code));
      if (!result.ok) {
        setError("That invite code isn't valid.");
        return;
      }
      const unsub = listenServerChannels(result.serverId, (channels) => {
        const first = channels.find((c) => c.type === "text") ?? channels[0];
        unsub();
        setCode("");
        onClose();
        if (first) router.push(`/app/servers/${result.serverId}/channels/${first.id}`);
      });
    } catch {
      setError("Something went wrong while joining.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Join with an invite">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="invite-code"
          label="Invite code or link"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 7K3PQ9XZ or a pasted invite link"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Join
        </Button>
      </form>
    </Modal>
  );
}
