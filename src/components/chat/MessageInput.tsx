"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Send, X, ImageIcon, Reply, Sticker } from "lucide-react";
import { animate } from "animejs";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { assertFileSize } from "@/lib/sanitize";
import { GifPicker } from "./GifPicker";
import type { MessageData } from "@/types";

function ReplyChip({ replyTo, onCancel }: { replyTo: MessageData; onCancel: () => void }) {
  const profile = useUserProfile(replyTo.senderId);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="mb-2 flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs"
    >
      <Reply size={13} className="shrink-0 -scale-x-100 text-muted" />
      <span className="text-muted">
        Replying to <span className="font-medium text-foreground">{profile?.username ?? "..."}</span>
      </span>
      <span className="truncate text-muted">
        {replyTo.text || (replyTo.imageUrl ? "📷 Photo" : "")}
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="ml-auto shrink-0 rounded p-0.5 text-muted hover:text-danger cursor-pointer"
        aria-label="Cancel reply"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// A pending attachment is either a locally-picked file (paste or file
// input - uploaded via `uploadImage` at send time) or a GIF picked from
// KLIPY (not yet re-hosted on Cloudinary - uploaded via `uploadGif` at send
// time). Deferring both until send, rather than uploading on pick, matches
// the existing paste/attach flow and lets the user back out with no
// leftover upload.
type PendingAttachment =
  | { kind: "file"; file: File; previewUrl: string }
  | { kind: "gif"; sourceUrl: string; previewUrl: string };

export function MessageInput({
  onSend,
  uploadImage,
  uploadGif,
  placeholder,
  onTypingChange,
  replyTo,
  onCancelReply,
}: {
  onSend: (content: { text?: string; imageUrl?: string; replyTo?: MessageData }) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  uploadGif: (sourceUrl: string) => Promise<string>;
  placeholder: string;
  onTypingChange?: (isTyping: boolean) => void;
  replyTo?: MessageData | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendIconRef = useRef<HTMLSpanElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopTyping() {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onTypingChange?.(false);
  }

  function handleTextChange(value: string) {
    setText(value);
    if (!onTypingChange) return;
    if (!value.trim()) {
      stopTyping();
      return;
    }
    onTypingChange(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(stopTyping, 3000);
  }

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  // Stop signalling "typing" if the input unmounts mid-type (channel/DM
  // switch, navigating away) - the `key={channelId}` on the parent page
  // remounts this component per thread, so this always fires for the
  // thread being left.
  useEffect(() => {
    return () => stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearPending() {
    if (pending?.kind === "file") URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  }

  function selectImageFile(file: File) {
    try {
      assertFileSize(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file is too large.");
      return;
    }
    setError(null);
    setPending({ kind: "file", file, previewUrl: URL.createObjectURL(file) });
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          selectImageFile(file);
        }
        break;
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectImageFile(file);
    // Reset so picking the exact same file again still fires onChange.
    e.target.value = "";
  }

  async function handleSend() {
    if (sending) return;
    if (!text.trim() && !pending) return;
    setSending(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (pending) {
        imageUrl = pending.kind === "file" ? await uploadImage(pending.file) : await uploadGif(pending.sourceUrl);
      }
      await onSend({ text: text.trim() || undefined, imageUrl, replyTo: replyTo ?? undefined });
      setText("");
      stopTyping();
      if (pending) clearPending();
      onCancelReply?.();
      inputRef.current?.focus();
      if (sendIconRef.current) {
        animate(sendIconRef.current, {
          translateX: [0, 16, 0],
          translateY: [0, -8, 0],
          opacity: [1, 0.3, 1],
          duration: 400,
          ease: "outBack",
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(pending ? `Couldn't upload the image: ${detail}` : `Couldn't send the message: ${detail}`);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="border-t border-border p-3">
      <AnimatePresence>
        {replyTo && <ReplyChip key="reply" replyTo={replyTo} onCancel={() => onCancelReply?.()} />}
      </AnimatePresence>
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
            className="flex w-fit items-center gap-2 overflow-hidden rounded-lg border border-border bg-surface-2 p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pending.previewUrl}
              alt="preview"
              className="h-16 w-16 rounded object-cover"
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={clearPending}
              className="rounded p-1 text-muted hover:text-danger cursor-pointer"
            >
              <X size={16} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-1 shrink-0 cursor-pointer rounded-md p-0.5 text-muted hover:text-foreground"
          aria-label="Attach an image or GIF"
        >
          <ImageIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => setGifPickerOpen(true)}
          className="mb-1 shrink-0 cursor-pointer rounded-md p-0.5 text-muted hover:text-foreground"
          aria-label="Search a GIF"
        >
          <Sticker size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <Button
          onClick={handleSend}
          loading={sending}
          disabled={!text.trim() && !pending}
          className="!h-8 !w-8 !p-0"
        >
          <span ref={sendIconRef} className="inline-flex">
            <Send size={16} />
          </span>
        </Button>
      </div>
      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mt-1 text-[11px] text-danger"
          >
            {error}
          </motion.p>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 text-[11px] text-muted"
          >
            Attach a photo/GIF, search a GIF, or paste an image with Ctrl+V.
          </motion.p>
        )}
      </AnimatePresence>
      <GifPicker
        open={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onPick={(sourceUrl, previewUrl) => {
          setPending({ kind: "gif", sourceUrl, previewUrl });
          setGifPickerOpen(false);
        }}
      />
    </div>
  );
}
