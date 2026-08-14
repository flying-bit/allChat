"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Star } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth-context";
import { clsx } from "@/lib/clsx";
import {
  searchGifs,
  fetchTrendingGifs,
  listenGifFavorites,
  setGifFavorite,
  removeGifFavorite,
} from "@/lib/db";
import type { GifFavorite } from "@/types";

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
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifItem[]>([]);
  const [favorites, setFavorites] = useState<GifFavorite[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    return listenGifFavorites(user.uid, setFavorites);
  }, [open, user]);

  useEffect(() => {
    if (!open || showFavorites) return;
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
  }, [open, query, showFavorites]);

  const favoriteKeys = new Set(favorites.map((f) => f.fullUrl));
  const visibleItems: GifItem[] = showFavorites
    ? favorites.map((f) => ({ key: f.fullUrl, thumbUrl: f.thumbUrl, fullUrl: f.fullUrl }))
    : items;

  function toggleFavorite(item: GifItem) {
    if (!user) return;
    if (favoriteKeys.has(item.fullUrl)) void removeGifFavorite(user.uid, item.fullUrl);
    else void setGifFavorite(user.uid, item.fullUrl, item.thumbUrl);
  }

  return (
    <Modal open={open} onClose={onClose} title="Choose a GIF">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowFavorites(false);
            }}
            placeholder="Search GIFs..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFavorites((v) => !v)}
          title="My favorite GIFs"
          className={clsx(
            "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition-colors",
            showFavorites
              ? "border-accent/50 bg-accent/15 text-accent"
              : "border-border bg-surface-2 text-muted hover:text-foreground"
          )}
        >
          <Star size={14} className={showFavorites ? "fill-current" : ""} />
        </button>
      </div>
      <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const isFavorite = favoriteKeys.has(item.fullUrl);
          return (
            <div key={item.key} className="group relative aspect-square">
              <button
                type="button"
                onClick={() => onPick(item.fullUrl, item.thumbUrl)}
                className="h-full w-full cursor-pointer overflow-hidden rounded-lg border border-border bg-surface-2 hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
              </button>
              {/* Faint by default (not opacity-0) so it's discoverable on
                  touch devices too, not just on hover - a fully-hidden
                  affordance was the exact bug fixed in the avatar/banner
                  pickers earlier. Full opacity on hover or once favorited. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item);
                }}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                className={clsx(
                  "absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white transition-opacity cursor-pointer",
                  isFavorite ? "opacity-100" : "opacity-50 hover:opacity-100 group-hover:opacity-100"
                )}
              >
                <Star size={14} className={isFavorite ? "fill-yellow-400 text-yellow-400" : ""} />
              </button>
            </div>
          );
        })}
      </div>
      {loading && <p className="mt-3 text-center text-xs text-muted">Loading...</p>}
      {error && <p className="mt-3 text-center text-xs text-danger">{error}</p>}
      {!loading && !error && visibleItems.length === 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          {showFavorites ? "No favorites yet - tap the star on any GIF." : "No GIFs found."}
        </p>
      )}
    </Modal>
  );
}
