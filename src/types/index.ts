export interface UserProfile {
  uid: string;
  username: string;
  usernameLower: string;
  email: string;
  createdAt: number;
  avatarUrl?: string;
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

export interface MessageData {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  createdAt: number;
}

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
