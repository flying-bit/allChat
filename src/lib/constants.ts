// IDs are stable database keys - keep them as-is even though the display
// names below are English, so existing deployments aren't orphaned.
export const GENESIS_SERVER_ID = "genesis";
export const GENESIS_SERVER_NAME = "allChat Hub";
export const GENESIS_TEXT_CHANNEL_ID = "genel";
export const GENESIS_TEXT_CHANNEL_NAME = "general";
export const GENESIS_VOICE_CHANNEL_ID = "sesli-sohbet";
export const GENESIS_VOICE_CHANNEL_NAME = "Voice Chat";

export const MAX_VC_USERS = 4;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const PALETTE = {
  blurple: "#5865F2",
  green: "#23A55A",
  yellow: "#F0B232",
  fuchsia: "#EB459E",
  red: "#DA373C",
} as const;

export const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;
