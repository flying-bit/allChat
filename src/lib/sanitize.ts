// Input validation shared by both the client (fast feedback) and the data
// layer in db.ts (defense in depth - db.ts must not trust any caller,
// including future ones). The real enforcement backstop that a hostile
// client can't bypass is always database.rules.json; these just keep
// obviously-bad data from ever reaching a `set`/`update` call, and keep
// error messages meaningful instead of a generic Firebase permission-denied.

import {
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  USERNAME_PATTERN,
  MAX_SERVER_NAME_LENGTH,
  MAX_CHANNEL_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_IMAGE_BYTES,
  CLOUDINARY_URL_PREFIX,
} from "./constants";

// Strips characters that have no business in a chat message/name: C0/C1
// control characters (other than newline/tab) and bidi override characters
// sometimes used to obfuscate spam/phishing text. This isn't an XSS defense
// - React already escapes everything it renders - it's about not
// persisting invisible junk.
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200E\\u200F\\u202A-\\u202E]",
  "g"
);

function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS, "");
}

export function assertValidUsername(raw: string): string {
  const trimmed = stripControlChars(raw).trim();
  if (trimmed.length < MIN_USERNAME_LENGTH) {
    throw new Error(`Username must be at least ${MIN_USERNAME_LENGTH} characters long.`);
  }
  if (trimmed.length > MAX_USERNAME_LENGTH) {
    throw new Error(`Username must be at most ${MAX_USERNAME_LENGTH} characters long.`);
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new Error("Username can only contain letters, numbers, and underscores.");
  }
  return trimmed;
}

export function assertValidServerName(raw: string): string {
  const trimmed = stripControlChars(raw).trim();
  if (!trimmed) throw new Error("Server name can't be empty.");
  if (trimmed.length > MAX_SERVER_NAME_LENGTH) {
    throw new Error(`Server name must be at most ${MAX_SERVER_NAME_LENGTH} characters long.`);
  }
  return trimmed;
}

export function assertValidChannelName(raw: string): string {
  const trimmed = stripControlChars(raw).trim();
  if (!trimmed) throw new Error("Channel name can't be empty.");
  if (trimmed.length > MAX_CHANNEL_NAME_LENGTH) {
    throw new Error(`Channel name must be at most ${MAX_CHANNEL_NAME_LENGTH} characters long.`);
  }
  return trimmed;
}

// Returns undefined for empty/whitespace-only input so callers can treat it
// the same as "no text" (e.g. an image-only message).
export function sanitizeMessageText(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = stripControlChars(raw).trim();
  if (!cleaned) return undefined;
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages can't be longer than ${MAX_MESSAGE_LENGTH} characters.`);
  }
  return cleaned;
}

// Checked at file-selection time so an oversized file gets an immediate,
// specific error instead of a generic failure after a wasted upload
// round-trip (the server's MAX_BYTES check in /api/upload/route.ts is the
// real enforcement point - this is just faster feedback).
export function assertFileSize(file: File): File {
  if (file.size > MAX_IMAGE_BYTES) {
    const maxMb = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    throw new Error(`That file is too large (max ${maxMb}MB).`);
  }
  return file;
}

// imageUrl only ever comes from our own /api/upload response, but content
// is otherwise just fields on a plain object anyone with a valid ID token
// could `set()` directly via the Firebase SDK - so this must be checked
// server-side too (mirrored in database.rules.json).
export function isTrustedImageUrl(url: string): boolean {
  return url.startsWith(CLOUDINARY_URL_PREFIX);
}

export function assertTrustedImageUrl(url: string): string {
  if (!isTrustedImageUrl(url)) {
    throw new Error("Image URL is not from a trusted host.");
  }
  return url;
}
