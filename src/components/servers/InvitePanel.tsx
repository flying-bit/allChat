"use client";

import { useRef, useState } from "react";
import { animate } from "animejs";
import { Copy, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { regenerateInviteCode } from "@/lib/db";

export function inviteLinkFor(inviteCode: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/app/invite/${inviteCode}`;
}

export function InvitePanel({
  open,
  onClose,
  serverId,
  inviteCode,
  isOwner,
}: {
  open: boolean;
  onClose: () => void;
  serverId: string;
  inviteCode: string;
  isOwner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLinkFor(inviteCode));
    setCopied(true);
    if (badgeRef.current) {
      animate(badgeRef.current, {
        scale: [1, 1.15, 1],
        duration: 350,
        ease: "outQuad",
      });
    }
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      // The parent's live `servers/{id}` listener picks up the new code
      // and flows it back down as a fresh `inviteCode` prop.
      await regenerateInviteCode(serverId);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite people">
      <p className="mb-3 text-sm text-muted">
        Share this link - anyone who opens it joins the server directly (signing up first if
        they need to).
      </p>
      <div
        ref={badgeRef}
        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3"
      >
        <span className="truncate font-mono text-sm text-accent">{inviteLinkFor(inviteCode)}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-md p-2 text-muted hover:bg-surface hover:text-accent cursor-pointer"
          title="Copy link"
        >
          <Copy size={18} />
        </button>
      </div>
      {copied && <p className="mt-2 text-xs text-accent">Copied!</p>}
      <p className="mt-3 text-xs text-muted">
        Or share just the code: <span className="font-mono tracking-wide text-foreground">{inviteCode}</span>
      </p>
      {isOwner && (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={handleRegenerate}
          loading={regenerating}
        >
          <RefreshCw size={16} /> Regenerate code
        </Button>
      )}
    </Modal>
  );
}
