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
  onDisconnect,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
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
  MAX_REPLY_QUOTE_LENGTH,
} from "./constants";
import {
  assertValidUsername,
  assertValidServerName,
  assertValidChannelName,
  sanitizeMessageText,
  assertTrustedImageUrl,
} from "./sanitize";
import type {
  UserProfile,
  ServerData,
  ChannelData,
  CategoryData,
  MessageData,
  MessageReplyRef,
  DmThreadMeta,
  FriendRequestData,
  VoicePresenceData,
  StatusInfo,
  ReactionMap,
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

// Re-hosts a picked KLIPY GIF on our own Cloudinary account - see
// /api/upload-from-url's comment for why this can't just use KLIPY's URL
// directly in imageUrl/avatarUrl/bannerUrl.
export async function uploadGifFromUrl(folder: string, sourceUrl: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const res = await fetch("/api/upload-from-url", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sourceUrl, folder }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "GIF upload failed");
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

// ---------- GIF search (KLIPY, proxied server-side - see /api/gifs/*) ----------

export async function searchGifs(query: string, page = 1): Promise<unknown> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}&page=${page}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "GIF search failed");
  }
  return res.json();
}

export async function fetchTrendingGifs(page = 1): Promise<unknown> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const res = await fetch(`/api/gifs/trending?page=${page}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Couldn't load trending GIFs");
  }
  return res.json();
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
    // Membership-scoped channelMessages/voicePresence rules resolve a
    // channel's server via this index. ownerId "system" means no client
    // auth.uid can satisfy channelServer's write rule, so - like the rest
    // of this function - this only succeeds if rules ever allow it; genesis
    // and its channelServer entries must be seeded once by hand in the
    // Firebase console (see README).
    [`channelServer/${GENESIS_TEXT_CHANNEL_ID}`]: GENESIS_SERVER_ID,
    [`channelServer/${GENESIS_VOICE_CHANNEL_ID}`]: GENESIS_SERVER_ID,
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
  const trimmed = assertValidUsername(username);
  await ensureGenesisServer();
  const lower = usernameLower(trimmed);
  const updates: Record<string, unknown> = {
    [`users/${uid}`]: {
      uid,
      username: trimmed,
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

// Presence is tracked per-connection (one push id per open tab/device)
// under `presenceConnections/{uid}/{connId}`, each removed via its own
// onDisconnect. A single `status/{uid}.online` flag can't do this safely:
// with two tabs open, closing one would run that tab's onDisconnect and
// stamp the user offline even though the other tab is still connected -
// exactly the "shows online and offline at once" bug. Deriving "online"
// from whether any connection entry still exists fixes that.
export function setupPresence(uid: string) {
  const infoRef = ref(rtdb, ".info/connected");
  const connectionsRef = ref(rtdb, `presenceConnections/${uid}`);
  const statusRef = ref(rtdb, `status/${uid}`);

  const handler = onValue(infoRef, (snap) => {
    if (snap.val() === false) return;
    const myConnRef = push(connectionsRef);
    onDisconnect(myConnRef).remove();
    onDisconnect(statusRef).update({ lastSeen: serverTimestamp() });
    set(myConnRef, true);
    update(statusRef, { online: true, lastSeen: serverTimestamp() });
  });
  return () => off(infoRef, "value", handler);
}

export function listenStatus(uid: string, cb: (s: StatusInfo | null) => void) {
  const connectionsRef = ref(rtdb, `presenceConnections/${uid}`);
  const statusRef = ref(rtdb, `status/${uid}`);
  let online = false;
  let lastSeen = 0;
  let hasStatus = false;
  const emit = () => cb(hasStatus ? { online, lastSeen } : null);
  const h1 = onValue(connectionsRef, (snap) => {
    online = snap.exists();
    emit();
  });
  const h2 = onValue(statusRef, (snap) => {
    hasStatus = snap.exists();
    lastSeen = (snap.val() as StatusInfo | null)?.lastSeen ?? lastSeen;
    emit();
  });
  return () => {
    off(connectionsRef, "value", h1);
    off(statusRef, "value", h2);
  };
}

export async function updateUsername(uid: string, oldUsernameLower: string, newUsername: string) {
  const trimmed = assertValidUsername(newUsername);
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

// `source` is either a File (own upload, incl. .gif) or a KLIPY GIF URL
// (re-hosted on Cloudinary first) - either way this ends with a
// res.cloudinary.com URL, same as the avatar/server-icon flows.
export async function updateUserAvatarFromGif(uid: string, sourceUrl: string) {
  const url = await uploadGifFromUrl(`avatars/${uid}`, sourceUrl);
  await update(ref(rtdb, `users/${uid}`), { avatarUrl: url });
  return url;
}

export async function updateUserBanner(uid: string, file: File) {
  const url = await uploadImageToServer(`banners/${uid}`, file);
  await update(ref(rtdb, `users/${uid}`), { bannerUrl: url });
  return url;
}

export async function updateUserBannerFromGif(uid: string, sourceUrl: string) {
  const url = await uploadGifFromUrl(`banners/${uid}`, sourceUrl);
  await update(ref(rtdb, `users/${uid}`), { bannerUrl: url });
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
  await update(ref(rtdb, `servers/${serverId}`), { name: assertValidServerName(name) });
}

export async function updateServerIcon(serverId: string, file: File) {
  const url = await uploadImageToServer(`serverIcons/${serverId}`, file);
  await update(ref(rtdb, `servers/${serverId}`), { iconUrl: url });
  return url;
}

// Members other than the owner keep a dangling `userServers/{uid}/{serverId}`
// pointer after this - security rules only let each user write their own
// entry, so a full cascade would need a Cloud Function. That's harmless:
// once `servers/{serverId}` is gone, listenServer resolves to null and
// useUserServers filters the stale id out client-side.
export async function deleteServer(
  ownerUid: string,
  serverId: string,
  inviteCode: string | undefined,
  channelIds: string[]
) {
  // Two sequential updates, not one: the channelMessages/channelMessageReactions
  // owner-wipe rules authorize clearing via root.child('servers')...ownerId,
  // which must still resolve while `servers/{serverId}` exists. Nulling it in
  // the same multi-path update as the channel data would make root reflect
  // the post-write (already-deleted) state and reject the whole write. See
  // database.rules.json.
  const channelUpdates: Record<string, unknown> = {};
  for (const channelId of channelIds) {
    channelUpdates[`channelMessages/${channelId}`] = null;
    channelUpdates[`channelMessageReactions/${channelId}`] = null;
  }
  if (Object.keys(channelUpdates).length) await update(ref(rtdb), channelUpdates);

  // Voice presence isn't included here: security rules only grant write
  // access per-participant (`voicePresence/{channelId}/{uid}`), not at the
  // channel level, so bulk-clearing it would reject the whole atomic
  // update. It's ephemeral and self-clears via onDisconnect anyway.
  const updates: Record<string, unknown> = {
    [`servers/${serverId}`]: null,
    [`serverChannels/${serverId}`]: null,
    [`serverCategories/${serverId}`]: null,
    [`userServers/${ownerUid}/${serverId}`]: null,
  };
  if (inviteCode) updates[`serverInvites/${inviteCode}`] = null;
  await update(ref(rtdb), updates);
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
  const validName = assertValidServerName(name);
  const serverId = push(ref(rtdb, "servers")).key as string;
  const inviteCode = nanoid();
  const textChannelId = push(ref(rtdb, `serverChannels/${serverId}`)).key as string;
  const voiceChannelId = push(ref(rtdb, `serverChannels/${serverId}`)).key as string;

  const updates: Record<string, unknown> = {
    [`servers/${serverId}`]: {
      name: validName,
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
    // Written in the same atomic update as `servers/{serverId}` - root.child()
    // reads in that rule do NOT reliably see this same-call sibling write, so
    // channelServer's .write rule has a "target server doesn't exist yet"
    // fallback clause for exactly this case (mirroring serverChannels'
    // pre-existing !root.child('servers').child($serverId).exists() escape
    // hatch). See database.rules.json.
    [`channelServer/${textChannelId}`]: serverId,
    [`channelServer/${voiceChannelId}`]: serverId,
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
  const validName = assertValidChannelName(name);
  const channelId = push(ref(rtdb, `serverChannels/${serverId}`)).key as string;
  const updates: Record<string, unknown> = {
    [`serverChannels/${serverId}/${channelId}`]: stripUndefined({
      name: validName,
      type,
      order,
      createdAt: serverTimestamp(),
      categoryId,
    }),
    [`channelServer/${channelId}`]: serverId,
  };
  await update(ref(rtdb), updates);
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

// Frozen at send time - see the MessageReplyRef comment in types/index.ts
// for why this isn't resolved live from the original message.
function buildReplyRef(source: MessageData): MessageReplyRef {
  return stripUndefined({
    messageId: source.id,
    senderId: source.senderId,
    text: source.text ? source.text.slice(0, MAX_REPLY_QUOTE_LENGTH) : undefined,
    hasImage: source.imageUrl ? true : undefined,
  }) as MessageReplyRef;
}

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
  content: { text?: string; imageUrl?: string; replyTo?: MessageData }
) {
  const text = sanitizeMessageText(content.text);
  const imageUrl = content.imageUrl ? assertTrustedImageUrl(content.imageUrl) : undefined;
  if (!text && !imageUrl) return;
  const replyTo = content.replyTo ? buildReplyRef(content.replyTo) : undefined;
  const msgRef = push(ref(rtdb, `channelMessages/${channelId}`));
  // Written together with messageRateLimit/{senderId} so the rules' throttle
  // check (`.validate` on that node) either accepts or rejects both writes
  // atomically - a spamming client can't sneak the message through without
  // the rate-limit stamp, or vice versa.
  await update(ref(rtdb), {
    [`channelMessages/${channelId}/${msgRef.key}`]: {
      senderId,
      ...stripUndefined({ text, imageUrl, replyTo }),
      createdAt: serverTimestamp(),
    },
    [`messageRateLimit/${senderId}`]: serverTimestamp(),
  });
}

// Reactions live outside the message node (channelMessageReactions/{channelId})
// specifically so any member can toggle their own reaction without needing
// write access to a message someone else authored - see database.rules.json.
export async function deleteChannelMessage(channelId: string, messageId: string) {
  // Two sequential writes, not one atomic multi-path update: the reactions
  // .write rule authorizes "clear all reactions for this message" by
  // checking the message's *current* senderId via root.child(...), which
  // only works while the message still exists. Deleting it first would
  // make that check un-satisfiable in the same call. See database.rules.json.
  await remove(ref(rtdb, `channelMessageReactions/${channelId}/${messageId}`));
  await remove(ref(rtdb, `channelMessages/${channelId}/${messageId}`));
}

export async function setChannelReaction(
  channelId: string,
  messageId: string,
  emoji: string,
  uid: string,
  active: boolean
) {
  const r = ref(rtdb, `channelMessageReactions/${channelId}/${messageId}/${emoji}/${uid}`);
  if (active) await set(r, true);
  else await remove(r);
}

export function listenChannelReactions(
  channelId: string,
  cb: (reactions: Record<string, ReactionMap>) => void
) {
  const r = ref(rtdb, `channelMessageReactions/${channelId}`);
  const handler = onValue(r, (snap) => {
    cb((snap.val() as Record<string, ReactionMap> | null) ?? {});
  });
  return () => off(r, "value", handler);
}

// The most recent message's timestamp, for computing unread state without
// subscribing to the full message history of every channel.
export function listenChannelLastMessageAt(channelId: string, cb: (at: number) => void) {
  const r = query(ref(rtdb, `channelMessages/${channelId}`), orderByChild("createdAt"), limitToLast(1));
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, MessageData> | null;
    const latest = val ? Object.values(val)[0] : null;
    cb(latest?.createdAt ?? 0);
  });
  return () => off(r, "value", handler);
}

// ---------- Read tracking (for unread badges / notifications) ----------

export async function markChannelRead(uid: string, channelId: string) {
  await set(ref(rtdb, `userReads/${uid}/channels/${channelId}`), serverTimestamp());
}

export async function markDmRead(uid: string, otherUid: string) {
  await set(ref(rtdb, `userReads/${uid}/dms/${otherUid}`), serverTimestamp());
}

export function listenUserReads(
  uid: string,
  cb: (reads: { channels: Record<string, number>; dms: Record<string, number> }) => void
) {
  const r = ref(rtdb, `userReads/${uid}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as { channels?: Record<string, number>; dms?: Record<string, number> } | null;
    cb({ channels: val?.channels ?? {}, dms: val?.dms ?? {} });
  });
  return () => off(r, "value", handler);
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
    const val = snap.val() as Record<
      string,
      { dmId: string; lastMessageAt: number; lastSenderId?: string }
    > | null;
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
  content: { text?: string; imageUrl?: string; replyTo?: MessageData }
) {
  const text = sanitizeMessageText(content.text);
  const imageUrl = content.imageUrl ? assertTrustedImageUrl(content.imageUrl) : undefined;
  if (!text && !imageUrl) return;
  const replyTo = content.replyTo ? buildReplyRef(content.replyTo) : undefined;
  const dmId = dmIdFor(myUid, otherUid);
  const msgRef = push(ref(rtdb, `dmMessages/${dmId}`));
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`dmMessages/${dmId}/${msgRef.key}`]: {
      senderId: myUid,
      ...stripUndefined({ text, imageUrl, replyTo }),
      createdAt: serverTimestamp(),
    },
    [`userDms/${myUid}/${otherUid}`]: { dmId, lastMessageAt: now, lastSenderId: myUid },
    [`userDms/${otherUid}/${myUid}`]: { dmId, lastMessageAt: now, lastSenderId: myUid },
    [`messageRateLimit/${myUid}`]: serverTimestamp(),
  };
  await update(ref(rtdb), updates);
}

export async function deleteDmMessage(dmId: string, messageId: string) {
  await remove(ref(rtdb, `dmMessageReactions/${dmId}/${messageId}`));
  await remove(ref(rtdb, `dmMessages/${dmId}/${messageId}`));
}

export async function setDmReaction(
  dmId: string,
  messageId: string,
  emoji: string,
  uid: string,
  active: boolean
) {
  const r = ref(rtdb, `dmMessageReactions/${dmId}/${messageId}/${emoji}/${uid}`);
  if (active) await set(r, true);
  else await remove(r);
}

export function listenDmReactions(
  dmId: string,
  cb: (reactions: Record<string, ReactionMap>) => void
) {
  const r = ref(rtdb, `dmMessageReactions/${dmId}`);
  const handler = onValue(r, (snap) => {
    cb((snap.val() as Record<string, ReactionMap> | null) ?? {});
  });
  return () => off(r, "value", handler);
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
  // Previously used runTransaction() on the *parent* `voicePresence/{channelId}`
  // path to atomically enforce the MAX_VC_USERS cap - but security rules only
  // ever grant .write at the child `voicePresence/{channelId}/{uid}` level, and
  // a transaction needs write permission at the exact path it targets. That
  // meant every join was silently rejected with PERMISSION_DENIED (this was
  // the "can't join voice channels at all" bug).
  //
  // The cap can't be moved into the rule either: Realtime Database's rules
  // language has no numChildren()/parent() (that's the client SDK's
  // DataSnapshot, not the sandboxed RuleDataSnapshot rules run against) and
  // no iteration, so there's no way to count siblings there without a
  // separately-maintained counter node - which itself needs a Cloud Function
  // to stay tamper-proof, and this project doesn't have Functions deployed.
  //
  // So this is a best-effort, non-atomic check: read the current count, then
  // write if under the cap. Two joins racing in the same instant can both
  // pass the check and briefly land 5 people in a "4-person" channel - low
  // stakes for a voice room, self-corrects as soon as anyone leaves. A hard
  // cap would require a Cloud Function trigger on this path.
  const presenceRef = ref(rtdb, `voicePresence/${channelId}`);
  const snap = await get(presenceRef);
  const current = (snap.val() as Record<string, VoicePresenceData> | null) ?? {};
  const others = Object.keys(current).filter((k) => k !== uid);
  if (others.length >= MAX_VC_USERS) return false;

  const myRef = ref(rtdb, `voicePresence/${channelId}/${uid}`);
  try {
    await set(myRef, { peerId, displayName, joinedAt: Date.now() });
  } catch {
    return false; // no longer a member of the channel's server
  }
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

// ---------- Typing indicators ----------
// `threadId` is a channelId for server text channels, or a dmId for DMs.

export function setTyping(threadId: string, uid: string, username: string) {
  const r = ref(rtdb, `typing/${threadId}/${uid}`);
  onDisconnect(r).remove();
  void set(r, username);
}

export function clearTyping(threadId: string, uid: string) {
  void remove(ref(rtdb, `typing/${threadId}/${uid}`));
}

export function listenTyping(
  threadId: string,
  cb: (users: { uid: string; username: string }[]) => void
) {
  const r = ref(rtdb, `typing/${threadId}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() as Record<string, string> | null;
    cb(val ? Object.entries(val).map(([uid, username]) => ({ uid, username })) : []);
  });
  return () => off(r, "value", handler);
}
