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
  hasVideo?: boolean;
}

export interface MessageData {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
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

// 1:1 DM voice/video call, PeerJS-based (see src/lib/dm-call-context.tsx).
// One node per dmId - a DM can only have one call in flight at a time.
// "ringing" until the callee answers (calleePeerId is set at that point),
// then "active" for the rest of the call; the node is deleted outright on
// hangup/decline/cancel rather than tracking an "ended" status.
export type DmCallStatus = "ringing" | "active";

export interface DmCallData {
  callerId: string;
  calleeId: string;
  callerPeerId: string;
  calleePeerId?: string;
  status: DmCallStatus;
  startedAt: number;
}

// Denormalized under the callee's own uid (dmIncomingCall/{calleeId}) so
// they can listen for an incoming call without knowing every dmId they
// might be called on ahead of time - same reasoning as userDms.
export interface DmIncomingCallData {
  dmId: string;
  callerId: string;
  callerPeerId: string;
  startedAt: number;
}

// Keyed by a stable hash of fullUrl (see stableKeyForUrl in db.ts) -
// RTDB keys can't contain the characters a URL is full of.
export interface GifFavorite {
  thumbUrl: string;
  fullUrl: string;
  addedAt: number;
}
