"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { searchGifs, fetchTrendingGifs } from "@/lib/db";

interface GifItem {
  key: string;
  thumbUrl: string;
  fullUrl: string;
}

// Confirmed against a live search/trending response: item.file.{sm,md,hd,xs}
// .{gif,webp,jpg,mp4,webm}.url. The other candidates are kept as a fallback
// in case KLIPY changes shape on some account tier - if GIFs ever stop
// showing up, the console.warn below logs the first raw item so a new
// candidate can be added.
const CANDIDATE_PATHS: { thumb: string[]; full: string[] }[] = [
  { thumb: ["file", "sm", "gif", "url"], full: ["file", "md", "gif", "url"] },
  { thumb: ["files", "sm", "gif", "url"], full: ["files", "md", "gif", "url"] },
  { thumb: ["file", "preview", "url"], full: ["file", "gif", "url"] },
  { thumb: ["media_formats", "tinygif", "url"], full: ["media_formats", "gif", "url"] },
];

function dig(obj: unknown, path: string[]): string | null {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : null;
}

// Last-resort fallback: scan the item for any string value that looks like
// a GIF/media URL, so search doesn't come up completely empty just because
// CANDIDATE_PATHS above doesn't match this account's exact response shape.
function findAnyGifUrl(obj: unknown, depth = 0): string | null {
  if (depth > 4 || !obj || typeof obj !== "object") return null;
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (typeof value === "string" && /^https?:\/\/.*\.(gif|webp)(\?|$)/i.test(value)) {
      return value;
    }
    if (typeof value === "object") {
      const found = findAnyGifUrl(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

let warnedOnce = false;

function extractGifUrls(item: unknown): GifItem | null {
  for (const { thumb, full } of CANDIDATE_PATHS) {
    const fullUrl = dig(item, full);
    if (fullUrl) return { key: fullUrl, thumbUrl: dig(item, thumb) ?? fullUrl, fullUrl };
  }
  const fallback = findAnyGifUrl(item);
  if (fallback) return { key: fallback, thumbUrl: fallback, fullUrl: fallback };
  if (!warnedOnce) {
    warnedOnce = true;
    console.warn(
      "[GifPicker] Couldn't find a GIF URL in KLIPY's response shape - raw item:",
      item
    );
  }
  return null;
}

function parseItems(payload: unknown): GifItem[] {
  const list =
    (payload as { data?: { data?: unknown[] } })?.data?.data ??
    (payload as { data?: unknown[] })?.data ??
    (payload as { results?: unknown[] })?.results ??
    [];
  if (!Array.isArray(list)) return [];
  return list.map(extractGifUrls).filter((x): x is GifItem => x !== null);
}

export function GifPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (sourceUrl: string, previewUrl: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // setLoading/setError happen inside the timeout callback, not
    // synchronously here, so a fast retype doesn't flash "Loading..." for
    // every keystroke - only once a debounced fetch actually starts.
    debounceRef.current = window.setTimeout(
      async () => {
        setError(null);
        setLoading(true);
        try {
          const payload = query.trim()
            ? await searchGifs(query.trim())
            : await fetchTrendingGifs();
          setItems(parseItems(payload));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't load GIFs.");
        } finally {
          setLoading(false);
        }
      },
      query.trim() ? 350 : 0
    );
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query]);

  return (
    <Modal open={open} onClose={onClose} title="Choose a GIF">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <Search size={16} className="text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(item.fullUrl, item.thumbUrl)}
            className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-border bg-surface-2 hover:opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {loading && <p className="mt-3 text-center text-xs text-muted">Loading...</p>}
      {error && <p className="mt-3 text-center text-xs text-danger">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="mt-3 text-center text-xs text-muted">No GIFs found.</p>
      )}
    </Modal>
  );
}
