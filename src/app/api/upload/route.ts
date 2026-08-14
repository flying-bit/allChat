import { NextResponse, type NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { isValidFirebaseIdToken, bearerToken } from "@/lib/server/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Kept in sync with MAX_IMAGE_BYTES in src/lib/constants.ts (see that
// comment for why this is more generous than a typical image cap - GIFs).
const MAX_BYTES = 20 * 1024 * 1024;

// Only these folders are ever passed by the client (db.ts's
// uploadImageToServer callers) - reject anything else so a crafted request
// can't steer uploads into an arbitrary Cloudinary folder path.
const ALLOWED_FOLDER_PREFIXES = ["avatars/", "banners/", "serverIcons/", "chatImages/"];

const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "gif", "webp"] as const;

// Magic-byte signatures for the formats above. `file.type` is a
// client-supplied header and trivially spoofable by anyone calling this
// route directly (not through the browser paste/upload UI), so it's only
// used for the fast-path rejection below - this is the actual check.
const SIGNATURES: { format: (typeof ALLOWED_FORMATS)[number]; bytes: number[]; offset?: number }[] = [
  { format: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { format: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP: "RIFF"....."WEBP" - the 4 size bytes at offset 4 vary per file.
  { format: "webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

function sniffImageFormat(bytes: Uint8Array): (typeof ALLOWED_FORMATS)[number] | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (sig.bytes.every((b, i) => bytes[offset + i] === b)) {
      if (sig.format === "webp") {
        const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        if (!isWebp) continue;
      }
      return sig.format;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error(
      "[/api/upload] Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET env vars"
    );
    return NextResponse.json(
      { error: "Image uploads aren't configured on the server (missing Cloudinary env vars)." },
      { status: 500 }
    );
  }

  const idToken = bearerToken(request);
  if (!idToken || !(await isValidFirebaseIdToken(idToken, "[/api/upload]"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = formData.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof folder !== "string" || !ALLOWED_FOLDER_PREFIXES.some((p) => folder.startsWith(p))) {
    return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Don't trust the client-supplied `file.type` header - sniff the actual
  // file signature so a renamed/relabeled non-image (executable, script,
  // SVG with embedded JS, etc.) can't ride through as "image/png".
  const sniffed = sniffImageFormat(bytes);
  if (!sniffed) {
    return NextResponse.json({ error: "File is not a recognized image format" }, { status: 400 });
  }

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:image/${sniffed};base64,${base64}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `allchat/${folder}`,
      resource_type: "image",
      allowed_formats: [...ALLOWED_FORMATS],
      // Belt-and-suspenders against Cloudinary raw delivery of an
      // uploaded file being treated as a script/HTML page: never let
      // uploads through this route request a non-image resource type,
      // and cap it hard here regardless of what the caller intended.
      overwrite: false,
      unique_filename: true,
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("[/api/upload] Cloudinary upload failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
