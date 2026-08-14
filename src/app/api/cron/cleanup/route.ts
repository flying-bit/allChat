import { NextResponse, type NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { adminDb } from "@/lib/server/firebaseAdmin";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MESSAGE_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;
const CHAT_IMAGE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

// Deletes messages (and their reactions) older than MESSAGE_RETENTION_MS
// from a thread-keyed tree - channelMessages/{threadId}/{messageId} or
// dmMessages/{threadId}/{messageId}, both share the same shape.
//
// This downloads the whole tree rather than querying per-thread with
// orderByChild('createdAt').endAt(cutoff), which would be more bandwidth-
// efficient at scale - but the 5-day retention policy itself keeps the live
// tree small, so a full read stays cheap in practice. Worth revisiting with
// a per-thread scoped query (using the channelServer index, or a new
// equivalent thread-id index for DMs) if this project ever outgrows that.
async function cleanupMessages(messagesPath: string, reactionsPath: string) {
  const db = adminDb();
  const cutoff = Date.now() - MESSAGE_RETENTION_MS;
  const snap = await db.ref(messagesPath).once("value");
  const tree = snap.val() as Record<string, Record<string, { createdAt?: number }>> | null;
  if (!tree) return 0;

  const updates: Record<string, null> = {};
  let count = 0;
  for (const [threadId, messages] of Object.entries(tree)) {
    for (const [messageId, msg] of Object.entries(messages ?? {})) {
      if (typeof msg?.createdAt === "number" && msg.createdAt < cutoff) {
        updates[`${messagesPath}/${threadId}/${messageId}`] = null;
        updates[`${reactionsPath}/${threadId}/${messageId}`] = null;
        count++;
      }
    }
  }
  if (count > 0) await db.ref().update(updates);
  return count;
}

// Only chatImages/ - not avatars/banners/serverIcons, which are meant to
// persist indefinitely, not expire on a timer.
async function cleanupChatImages() {
  const cutoffIso = new Date(Date.now() - CHAT_IMAGE_RETENTION_MS).toISOString();
  let deleted = 0;
  let nextCursor: string | undefined;
  do {
    const page = await cloudinary.api.resources({
      type: "upload",
      prefix: "allchat/chatImages/",
      max_results: 500,
      next_cursor: nextCursor,
    });
    const stale = (page.resources as { public_id: string; created_at: string }[]).filter(
      (r) => r.created_at < cutoffIso
    );
    for (let i = 0; i < stale.length; i += 100) {
      const batch = stale.slice(i, i + 100).map((r) => r.public_id);
      if (batch.length > 0) await cloudinary.api.delete_resources(batch);
      deleted += batch.length;
    }
    nextCursor = page.next_cursor;
  } while (nextCursor);
  return deleted;
}

// Runs daily via Vercel Cron (see vercel.json). Vercel adds
// `Authorization: Bearer $CRON_SECRET` automatically when that env var is
// set - this route rejects anything else so it can't be triggered by
// randomly guessing the URL.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = { channelMessagesDeleted: 0, dmMessagesDeleted: 0, chatImagesDeleted: 0, errors: [] as string[] };

  try {
    result.channelMessagesDeleted = await cleanupMessages("channelMessages", "channelMessageReactions");
  } catch (err) {
    console.error("[/api/cron/cleanup] channelMessages cleanup failed:", err);
    result.errors.push(`channelMessages: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    result.dmMessagesDeleted = await cleanupMessages("dmMessages", "dmMessageReactions");
  } catch (err) {
    console.error("[/api/cron/cleanup] dmMessages cleanup failed:", err);
    result.errors.push(`dmMessages: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    result.chatImagesDeleted = await cleanupChatImages();
  } catch (err) {
    console.error("[/api/cron/cleanup] Cloudinary cleanup failed:", err);
    result.errors.push(`chatImages: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json(result);
}
