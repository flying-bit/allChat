export interface UserProfile {
  uid: string;
  username: string;
  usernameLower: string;
  email: string;
  createdAt: number;
  avatarUrl?: string;
  // Both this and avatarUrl can point to an animated .gif on Cloudinary -
  // there's no separate "animated" flag, the browser just animates <img>
  // GIFs natively.
  bannerUrl?: string;
}

export interface StatusInfo {
  online: boolean;
  lastSeen: number;
}

export interface ServerData {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  defaultChannelId: string;
  inviteCode: string;
  iconUrl?: string;
}

export type ChannelType = "text" | "voice";

export interface ChannelData {
  id: string;
  name: string;
  type: ChannelType;
  order: number;
  createdAt: number;
  categoryId?: string;
}

export interface CategoryData {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

// Denormalized snapshot of the message being replied to, frozen at reply
// creation time. RTDB has no joins/foreign keys, and the original could be
// deleted later, so the quote is stored on the reply itself rather than
// resolved live - the sender's name/avatar still resolve live via
// `senderId` (useUserProfile), only the *content* preview is frozen.
export interface MessageReplyRef {
  messageId: string;
  senderId: string;
  text?: string;
  hasImage?: boolean;
}

export interface MessageData {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  createdAt: number;
  replyTo?: MessageReplyRef;
}

// emoji -> uid -> true. Stored separately from the message itself
// (channelMessageReactions / dmMessageReactions) so reacting doesn't
// require write access to someone else's message - see database.rules.json.
export type ReactionMap = Record<string, Record<string, true>>;

export interface DmThreadMeta {
  dmId: string;
  otherUid: string;
  lastMessageAt: number;
  lastSenderId?: string;
}

export interface FriendRequestData {
  createdAt: number;
  fromUsername?: string;
}

export interface VoicePresenceData {
  peerId: string;
  displayName: string;
  joinedAt: number;
  muted?: boolean;
}
