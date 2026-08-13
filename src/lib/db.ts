import { customAlphabet } from "nanoid";
import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  runTransaction,
  onDisconnect,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  type DatabaseReference,
} from "firebase/database";
import { rtdb, auth } from "./firebase";
import {
  GENESIS_SERVER_ID,
  GENESIS_SERVER_NAME,
  GENESIS_TEXT_CHANNEL_ID,
  GENESIS_TEXT_CHANNEL_NAME,
  GENESIS_VOICE_CHANNEL_ID,
  GENESIS_VOICE_CHANNEL_NAME,
  MAX_VC_USERS,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "./constants";
import type {
  UserProfile,
  ServerData,
  ChannelData,
  CategoryData,
  MessageData,
  DmThreadMeta,
  FriendRequestData,
  VoicePresenceData,
  StatusInfo,
} from "@/types";

const nanoid = customAlphabet(INVITE_ALPHABET, INVITE_CODE_LENGTH);

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

function toArray<T>(val: Record<string, unknown> | null): (T & { id: string })[] {
  if (!val) return [];
  return Object.entries(val).map(([id, v]) => ({ id, ...(v as object) } as T & { id: string }));
}

// ---------- Image uploads (proxied through /api/upload -> Cloudinary) ----------

async function uploadImageToServer(folder: string, file: File): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Image upload failed");
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

// ---------- Users ----------

export function usernameLower(username: string) {
  return username.trim().toLowerCase();
}

export async function isUsernameAvailable(username: string) {
  const snap = await get(ref(rtdb, `usernames/${usernameLower(username)}`));
  return !snap.exists();
}

export async function ensureGenesisServer() {
  const snap = await get(ref(rtdb, `servers/${GENESIS_SERVER_ID}`));
  if (snap.exists()) return;
  const updates: Record<string, unknown> = {
    [`servers/${GENESIS_SERVER_ID}`]: {
      name: GENESIS_SERVER_NAME,
      ownerId: "system",
      createdAt: serverTimestamp(),
      defaultChannelId: GENESIS_TEXT_CHANNEL_ID,
      inviteCode: "",
    },
    [`serverChannels/${GENESIS_SERVER_ID}/${GENESIS_TEXT_CHANNEL_ID}`]: {
      name: GENESIS_TEXT_CHANNEL_NAME,
      type: "text",
      order: 0,
      createdAt: serverTimestamp(),
    },
    [`serverChannels/${GENESIS_SERVER_ID}/${GENESIS_VOICE_CHANNEL_ID}`]: {
      name: GENESIS_VOICE_CHANNEL_NAME,
      type: "voice",
      order: 1,
      createdAt: serverTimestamp(),
    },
  };
  try {
    await update(ref(rtdb), updates);
  } catch {
    // Another client created it first (or ownerId "system" write rejected) - ignore.
  }
}

export async function createUserProfile(
  uid: string,
  username: string,
  email: string
) {
  await ensureGenesisServer();
  const lower = usernameLower(username);
  const updates: Record<string, unknown> = {
    [`users/${uid}`]: {
      uid,
      username,
      usernameLower: lower,
      email,
      createdAt: serverTimestamp(),
    },
    [`usernames/${lower}`]: uid,
    [`userServers/${uid}/${GENESIS_SERVER_ID}`]: true,
    [`servers/${GENESIS_SERVER_ID}/members/${uid}`]: true,
    [`status/${uid}`]: { online: true, lastSeen: serverTimestamp() },
  };
  await update(ref(rtdb), updates);
}

export async function ensureJoinedGenesis(uid: string) {
  await ensureGenesisServer();
  const updates: Record<string, unknown> = {
    [`userServers/${uid}/${GENESIS_SERVER_ID}`]: true,
    [`servers/${GENESIS_SERVER_ID}/members/${uid}`]: true,
  };
  await update(ref(rtdb), updates);
}

export function listenUserProfile(uid: string, cb: (p: UserProfile | null) => void) {
  const r = ref(rtdb, `users/${uid}`);
  const handler = onValue(r, (snap) => cb(snap.exists() ? (snap.val() as UserProfile) : null));
  return () => off(r, "value", handler);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await get(ref(rtdb, `users/${uid}`));
  return snap.exists() ? (snap.val() as UserProfile) : null;
}

export function setupPresence(uid: string) {
  const statusRef = ref(rtdb, `status/${uid}`);
  const infoRef = ref(rtdb, ".info/connected");
  const handler = onValue(infoRef, (snap) => {
    if (snap.val() === false) return;
    onDisconnect(statusRef)
      .set({ online: false, lastSeen: serverTimestamp() })
      .then(() => {
        set(statusRef, { online: true, lastSeen: serverTimestamp() });
      });
  });
  return () => off(infoRef, "value", handler);
}

export function listenStatus(uid: string, cb: (s: StatusInfo | null) => void) {
  const r = ref(rtdb, `status/${uid}`);
  const handler = onValue(r, (snap) => cb(snap.exists() ? (snap.val() as StatusInfo) : null));
  return () => off(r, "value", handler);
}

export async function updateUsername(uid: string, oldUsernameLower: string, newUsername: string) {
  const trimmed = newUsername.trim();
  const newLower = usernameLower(trimmed);
  if (newLower === oldUsernameLower) return;
  const available = await isUsernameAvailable(trimmed);
  if (!available) throw new Error("That username is already taken.");
  const updates: Record<string, unknown> = {
    [`usernames/${oldUsernameLower}`]: null,
    [`usernames/${newLower}`]: uid,
    [`users/${uid}/username`]: trimmed,
    [`users/${uid}/usernameLower`]: newLower,
  };
  await update(ref(rtdb), updates);
}

export async function updateUserAvatar(uid: string, file: File) {
  const url = await uploadImageToServer(`avatars/${uid}`, file);
  await update(ref(rtdb, `users/${uid}`), { avatarUrl: url });
  return url;
}

// ---------- Servers ----------

export function listenUserServerIds(uid: string, cb: (ids: string[]) => void) {
  const r = ref(rtdb, `userServers/${uid}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, boolean> | null;
    cb(val ? Object.keys(val) : []);
  });
  return () => off(r, "value", handler);
}

export function listenServer(serverId: string, cb: (s: ServerData | null) => void) {
  const r = ref(rtdb, `servers/${serverId}`);
  const handler = onValue(r, (snap) =>
    cb(snap.exists() ? ({ id: serverId, ...snap.val() } as ServerData) : null)
  );
  return () => off(r, "value", handler);
}

export function listenServerMemberIds(serverId: string, cb: (uids: string[]) => void) {
  const r = ref(rtdb, `servers/${serverId}/members`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, boolean> | null;
    cb(val ? Object.keys(val) : []);
  });
  return () => off(r, "value", handler);
}

export async function updateServerName(serverId: string, name: string) {
  await update(ref(rtdb, `servers/${serverId}`), { name: name.trim() });
}

export async function updateServerIcon(serverId: string, file: File) {
  const url = await uploadImageToServer(`serverIcons/${serverId}`, file);
  await update(ref(rtdb, `servers/${serverId}`), { iconUrl: url });
  return url;
}

export function listenServerChannels(serverId: string, cb: (channels: ChannelData[]) => void) {
  const r = ref(rtdb, `serverChannels/${serverId}`);
  const handler = onValue(r, (snap) => {
    const list = toArray<ChannelData>(snap.val());
    list.sort((a, b) => a.order - b.order);
    cb(list);
  });
  return () => off(r, "value", handler);
}

export async function createServer(uid: string, name: string) {
  const serverId = push(ref(rtdb, "servers")).key as string;
  const inviteCode = nanoid();
  const textChannelId = push(ref(rtdb, `serverChannels/${serverId}`)).key as string;
  const voiceChannelId = push(ref(rtdb, `serverChannels/${serverId}`)).key as string;

  const updates: Record<string, unknown> = {
    [`servers/${serverId}`]: {
      name,
      ownerId: uid,
      createdAt: serverTimestamp(),
      defaultChannelId: textChannelId,
      inviteCode,
    },
    [`serverChannels/${serverId}/${textChannelId}`]: {
      name: "general",
      type: "text",
      order: 0,
      createdAt: serverTimestamp(),
    },
    [`serverChannels/${serverId}/${voiceChannelId}`]: {
      name: "Voice Chat",
      type: "voice",
      order: 1,
      createdAt: serverTimestamp(),
    },
    [`serverInvites/${inviteCode}`]: serverId,
    [`userServers/${uid}/${serverId}`]: true,
  };
  await update(ref(rtdb), updates);
  // members write happens after (rule scoped independently)
  await set(ref(rtdb, `servers/${serverId}/members/${uid}`), true);
  return { serverId, textChannelId };
}

export async function joinServerByInviteCode(uid: string, code: string) {
  const cleanCode = code.trim().toUpperCase();
  const snap = await get(ref(rtdb, `serverInvites/${cleanCode}`));
  if (!snap.exists()) return { ok: false as const, error: "invalid" as const };
  const serverId = snap.val() as string;
  await update(ref(rtdb), {
    [`userServers/${uid}/${serverId}`]: true,
    [`servers/${serverId}/members/${uid}`]: true,
  });
  return { ok: true as const, serverId };
}

export async function regenerateInviteCode(serverId: string) {
  const newCode = nanoid();
  const serverSnap = await get(ref(rtdb, `servers/${serverId}`));
  if (!serverSnap.exists()) return null;
  const data = serverSnap.val() as ServerData;
  const oldCode = data.inviteCode;
  const updates: Record<string, unknown> = {
    [`servers/${serverId}/inviteCode`]: newCode,
    [`serverInvites/${newCode}`]: serverId,
  };
  if (oldCode) updates[`serverInvites/${oldCode}`] = null;
  await update(ref(rtdb), updates);
  return newCode;
}

export function listenChannelMeta(
  serverId: string,
  channelId: string,
  cb: (c: ChannelData | null) => void
) {
  const r = ref(rtdb, `serverChannels/${serverId}/${channelId}`);
  const handler = onValue(r, (snap) =>
    cb(snap.exists() ? ({ id: channelId, ...snap.val() } as ChannelData) : null)
  );
  return () => off(r, "value", handler);
}

export async function createChannel(
  serverId: string,
  name: string,
  type: "text" | "voice",
  order: number,
  categoryId?: string
) {
  const channelId = push(ref(rtdb, `serverChannels/${serverId}`)).key as string;
  await set(
    ref(rtdb, `serverChannels/${serverId}/${channelId}`),
    stripUndefined({
      name,
      type,
      order,
      createdAt: serverTimestamp(),
      categoryId,
    })
  );
  return channelId;
}

// ---------- Categories ----------

export function listenServerCategories(serverId: string, cb: (categories: CategoryData[]) => void) {
  const r = ref(rtdb, `serverCategories/${serverId}`);
  const handler = onValue(r, (snap) => {
    const list = toArray<CategoryData>(snap.val());
    list.sort((a, b) => a.order - b.order);
    cb(list);
  });
  return () => off(r, "value", handler);
}

export async function createCategory(serverId: string, name: string, order: number) {
  const categoryId = push(ref(rtdb, `serverCategories/${serverId}`)).key as string;
  await set(ref(rtdb, `serverCategories/${serverId}/${categoryId}`), {
    name,
    order,
    createdAt: serverTimestamp(),
  });
  return categoryId;
}

export async function renameCategory(serverId: string, categoryId: string, name: string) {
  await update(ref(rtdb, `serverCategories/${serverId}/${categoryId}`), { name: name.trim() });
}

export async function deleteCategory(serverId: string, categoryId: string) {
  await remove(ref(rtdb, `serverCategories/${serverId}/${categoryId}`));
}

// ---------- Channel messages ----------

export function listenChannelMessages(channelId: string, cb: (msgs: MessageData[]) => void) {
  const r = query(ref(rtdb, `channelMessages/${channelId}`), orderByChild("createdAt"), limitToLast(100));
  const handler = onValue(r, (snap) => {
    const list = toArray<MessageData>(snap.val());
    list.sort((a, b) => a.createdAt - b.createdAt);
    cb(list);
  });
  return () => off(r, "value", handler);
}

export async function sendChannelMessage(
  channelId: string,
  senderId: string,
  content: { text?: string; imageUrl?: string }
) {
  const msgRef = push(ref(rtdb, `channelMessages/${channelId}`));
  await set(msgRef, {
    senderId,
    ...stripUndefined(content),
    createdAt: serverTimestamp(),
  });
}

// ---------- Images ----------

export async function uploadPastedImage(threadId: string, file: File) {
  return uploadImageToServer(`chatImages/${threadId}`, file);
}

// ---------- DMs ----------

export function dmIdFor(a: string, b: string) {
  return [a, b].sort().join("_");
}

export function listenUserDms(uid: string, cb: (dms: DmThreadMeta[]) => void) {
  const r = ref(rtdb, `userDms/${uid}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, { dmId: string; lastMessageAt: number }> | null;
    const list: DmThreadMeta[] = val
      ? Object.entries(val).map(([otherUid, v]) => ({ otherUid, ...v }))
      : [];
    list.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    cb(list);
  });
  return () => off(r, "value", handler);
}

export function listenDmMessages(dmId: string, cb: (msgs: MessageData[]) => void) {
  const r = query(ref(rtdb, `dmMessages/${dmId}`), orderByChild("createdAt"), limitToLast(100));
  const handler = onValue(r, (snap) => {
    const list = toArray<MessageData>(snap.val());
    list.sort((a, b) => a.createdAt - b.createdAt);
    cb(list);
  });
  return () => off(r, "value", handler);
}

export async function sendDmMessage(
  myUid: string,
  otherUid: string,
  content: { text?: string; imageUrl?: string }
) {
  const dmId = dmIdFor(myUid, otherUid);
  const msgRef = push(ref(rtdb, `dmMessages/${dmId}`));
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`dmMessages/${dmId}/${msgRef.key}`]: {
      senderId: myUid,
      ...stripUndefined(content),
      createdAt: serverTimestamp(),
    },
    [`userDms/${myUid}/${otherUid}`]: { dmId, lastMessageAt: now },
    [`userDms/${otherUid}/${myUid}`]: { dmId, lastMessageAt: now },
  };
  await update(ref(rtdb), updates);
}

// ---------- Friends ----------

export async function findUidByUsername(username: string) {
  const snap = await get(ref(rtdb, `usernames/${usernameLower(username)}`));
  return snap.exists() ? (snap.val() as string) : null;
}

export async function sendFriendRequest(fromUid: string, fromUsername: string, toUid: string) {
  const updates: Record<string, unknown> = {
    [`friendRequests/${toUid}/incoming/${fromUid}`]: {
      createdAt: serverTimestamp(),
      fromUsername,
    },
    [`friendRequests/${fromUid}/outgoing/${toUid}`]: {
      createdAt: serverTimestamp(),
    },
  };
  await update(ref(rtdb), updates);
}

export async function acceptFriendRequest(uid: string, otherUid: string) {
  const updates: Record<string, unknown> = {
    [`friends/${uid}/${otherUid}`]: true,
    [`friends/${otherUid}/${uid}`]: true,
    [`friendRequests/${uid}/incoming/${otherUid}`]: null,
    [`friendRequests/${otherUid}/outgoing/${uid}`]: null,
  };
  await update(ref(rtdb), updates);
}

export async function declineFriendRequest(uid: string, otherUid: string) {
  const updates: Record<string, unknown> = {
    [`friendRequests/${uid}/incoming/${otherUid}`]: null,
    [`friendRequests/${otherUid}/outgoing/${uid}`]: null,
  };
  await update(ref(rtdb), updates);
}

export async function removeFriend(uid: string, otherUid: string) {
  const updates: Record<string, unknown> = {
    [`friends/${uid}/${otherUid}`]: null,
    [`friends/${otherUid}/${uid}`]: null,
  };
  await update(ref(rtdb), updates);
}

export function listenFriends(uid: string, cb: (uids: string[]) => void) {
  const r = ref(rtdb, `friends/${uid}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, boolean> | null;
    cb(val ? Object.keys(val) : []);
  });
  return () => off(r, "value", handler);
}

export function listenIncomingFriendRequests(
  uid: string,
  cb: (reqs: (FriendRequestData & { fromUid: string })[]) => void
) {
  const r = ref(rtdb, `friendRequests/${uid}/incoming`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, FriendRequestData> | null;
    cb(val ? Object.entries(val).map(([fromUid, v]) => ({ fromUid, ...v })) : []);
  });
  return () => off(r, "value", handler);
}

export function listenOutgoingFriendRequests(uid: string, cb: (uids: string[]) => void) {
  const r = ref(rtdb, `friendRequests/${uid}/outgoing`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, unknown> | null;
    cb(val ? Object.keys(val) : []);
  });
  return () => off(r, "value", handler);
}

// ---------- Voice presence ----------

export async function joinVoiceChannel(
  channelId: string,
  uid: string,
  peerId: string,
  displayName: string
) {
  const channelRef = ref(rtdb, `voicePresence/${channelId}`) as DatabaseReference;
  const result = await runTransaction(channelRef, (current: Record<string, VoicePresenceData> | null) => {
    const existing = current || {};
    const others = Object.keys(existing).filter((k) => k !== uid);
    if (others.length >= MAX_VC_USERS) {
      return; // abort - full
    }
    return {
      ...existing,
      [uid]: { peerId, displayName, joinedAt: Date.now() },
    };
  });
  if (!result.committed) return false;
  const myRef = ref(rtdb, `voicePresence/${channelId}/${uid}`);
  onDisconnect(myRef).remove();
  return true;
}

export async function leaveVoiceChannel(channelId: string, uid: string) {
  await remove(ref(rtdb, `voicePresence/${channelId}/${uid}`));
}

export function listenVoicePresence(
  channelId: string,
  cb: (members: (VoicePresenceData & { uid: string })[]) => void
) {
  const r = ref(rtdb, `voicePresence/${channelId}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, VoicePresenceData> | null;
    cb(val ? Object.entries(val).map(([uid, v]) => ({ uid, ...v })) : []);
  });
  return () => off(r, "value", handler);
}
