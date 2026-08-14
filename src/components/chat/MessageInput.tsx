"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Send, X, ImageIcon } from "lucide-react";
import { animate } from "animejs";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";

export function MessageInput({
  onSend,
  uploadImage,
  placeholder,
}: {
  onSend: (content: { text?: string; imageUrl?: string }) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendIconRef = useRef<HTMLSpanElement>(null);

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
        }
        break;
      }
    }
  }

  async function handleSend() {
    if (sending) return;
    if (!text.trim() && !pendingImage) return;
    setSending(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (pendingImage) {
        imageUrl = await uploadImage(pendingImage.file);
      }
      await onSend({ text: text.trim() || undefined, imageUrl });
      setText("");
      if (pendingImage) {
        URL.revokeObjectURL(pendingImage.previewUrl);
        setPendingImage(null);
      }
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
      setError(
        err instanceof Error && pendingImage
          ? `Couldn't upload the image: ${err.message}`
          : "Couldn't send the message. Make sure the Firebase rules are applied."
      );
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
        {pendingImage && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
            className="flex w-fit items-center gap-2 overflow-hidden rounded-lg border border-border bg-surface-2 p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.previewUrl}
              alt="preview"
              className="h-16 w-16 rounded object-cover"
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                URL.revokeObjectURL(pendingImage.previewUrl);
                setPendingImage(null);
              }}
              className="rounded p-1 text-muted hover:text-danger cursor-pointer"
            >
              <X size={16} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <ImageIcon size={18} className="mb-1.5 text-muted" />
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <Button
          onClick={handleSend}
          loading={sending}
          disabled={!text.trim() && !pendingImage}
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
            You can paste an image with Ctrl+V.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
