// IDs are stable database keys - keep them as-is even though the display
// names below are English, so existing deployments aren't orphaned.
export const GENESIS_SERVER_ID = "genesis";
export const GENESIS_SERVER_NAME = "allChat Hub";
export const GENESIS_TEXT_CHANNEL_ID = "genel";
export const GENESIS_TEXT_CHANNEL_NAME = "general";
export const GENESIS_VOICE_CHANNEL_ID = "sesli-sohbet";
export const GENESIS_VOICE_CHANNEL_NAME = "Voice Chat";

export const MAX_VC_USERS = 4;
// Animated GIFs routinely run well past a typical static image's size, so
// this is more generous than a plain photo would need - mirrored as
// MAX_BYTES in src/app/api/upload/route.ts (the actual enforcement point;
// this copy just drives an immediate client-side check via
// sanitize.ts's assertFileSize, before wasting a round trip on a file
// that's going to be rejected anyway).
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
// Videos upload directly to Cloudinary (see /api/video-upload-signature),
// bypassing our own server entirely - so unlike images this isn't limited
// by Vercel's serverless request body cap, only by Cloudinary's own account
// limits (free tier: 100MB/file). This is an app-level choice, not a
// platform constraint.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// ---------- Validation & anti-abuse ----------
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const MAX_SERVER_NAME_LENGTH = 60;
export const MAX_CHANNEL_NAME_LENGTH = 100;
export const MAX_MESSAGE_LENGTH = 4000;
// Minimum ms between messages sent by a single user (channel or DM) -
// mirrored in database.rules.json's `messageRateLimit` validation, which is
// the actual enforcement point. This constant only drives client-side UX
// (e.g. disabling the send button early) and must stay <= the rules value.
export const MIN_MESSAGE_INTERVAL_MS = 400;
// imageUrl/avatarUrl/bannerUrl only ever come from:
// - our own /api/upload route, which always returns a Cloudinary secure_url
// - a GIF picked in GifPicker.tsx, linked directly from KLIPY's CDN rather
//   than re-hosted (their asset domain, confirmed against a live response -
//   see the GifPicker.tsx comment for why re-hosting isn't worth it)
// - Discord's CDN, trusted the same way as KLIPY's
// All three are enforced both client-side (sanitize.ts) and in
// database.rules.json - anything else is rejected.
export const CLOUDINARY_URL_PREFIX = "https://res.cloudinary.com/";
export const KLIPY_CDN_PREFIX = "https://static.klipy.com/";
export const DISCORD_CDN_PREFIX = "https://cdn.discordapp.com/";

// Quoted preview length for replies - the full original text is not kept,
// only this snapshot (see MessageReplyRef). Mirrored (as 300) in
// database.rules.json as an upper-bound backstop.
export const MAX_REPLY_QUOTE_LENGTH = 200;

// Reaction picker preset - database.rules.json also caps emoji key length
// generously (16 chars) as a backstop, but the UI only ever sends one of
// these.
export const PRESET_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

export const PALETTE = {
  blurple: "#5865F2",
  green: "#23A55A",
  yellow: "#F0B232",
  fuchsia: "#EB459E",
  red: "#DA373C",
} as const;

export const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;
