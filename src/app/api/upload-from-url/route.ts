import { NextResponse, type NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { isValidFirebaseIdToken, bearerToken } from "@/lib/server/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_FOLDER_PREFIXES = ["avatars/", "banners/", "serverIcons/", "chatImages/"];

// Re-hosts a KLIPY-picked GIF on our own Cloudinary account, the same way
// /api/upload does for user-uploaded files - so imageUrl/avatarUrl/bannerUrl
// only ever need to trust one domain (res.cloudinary.com), matching
// database.rules.json's `.beginsWith('https://res.cloudinary.com/')` checks.
// This route never receives arbitrary client bytes; it tells Cloudinary to
// fetch `sourceUrl` itself, so the one thing that must be enforced here is
// that sourceUrl is actually KLIPY's own CDN - otherwise this becomes an
// open URL-fetch proxy that launders any attacker-supplied URL through our
// Cloudinary account.
function isKlipyUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    return url.hostname === "klipy.com" || url.hostname.endsWith(".klipy.com");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json(
      { error: "Image uploads aren't configured on the server (missing Cloudinary env vars)." },
      { status: 500 }
    );
  }

  const idToken = bearerToken(request);
  if (!idToken || !(await isValidFirebaseIdToken(idToken, "[/api/upload-from-url]"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sourceUrl = body?.sourceUrl;
  const folder = body?.folder;

  if (typeof sourceUrl !== "string" || !isKlipyUrl(sourceUrl)) {
    return NextResponse.json({ error: "Invalid source URL" }, { status: 400 });
  }
  if (typeof folder !== "string" || !ALLOWED_FOLDER_PREFIXES.some((p) => folder.startsWith(p))) {
    return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
  }

  try {
    const result = await cloudinary.uploader.upload(sourceUrl, {
      folder: `allchat/${folder}`,
      resource_type: "image",
      allowed_formats: ["gif", "webp", "png", "jpg", "jpeg"],
      overwrite: false,
      unique_filename: true,
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("[/api/upload-from-url] Cloudinary upload failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
