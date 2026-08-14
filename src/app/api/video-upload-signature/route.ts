import { NextResponse, type NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { isValidFirebaseIdToken, bearerToken } from "@/lib/server/auth";

// Videos are uploaded directly from the browser to Cloudinary (not proxied
// through /api/upload like images) - a video can easily exceed Vercel's
// serverless function request-body limit, which routing it through our own
// server would hit. This route only ever hands out a short-lived signature
// scoped to one folder; the actual bytes never touch our server.
//
// Security model, verified against the real account (see git history for
// the manual test): Cloudinary recomputes the signature from `folder` +
// `timestamp` + `allowed_formats` server-side, so a client can't swap the
// destination folder or widen the allowed formats without invalidating it.
// `allowed_formats` is enforced regardless of which upload endpoint
// (image/video/raw) the signature is replayed against - confirmed a
// mislabeled non-video file gets rejected even when it's named ".mp4".
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_FOLDER_PREFIXES = ["chatVideos/"];
const ALLOWED_FORMATS = "mp4,mov,webm";

export async function POST(request: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json(
      { error: "Video uploads aren't configured on the server (missing Cloudinary env vars)." },
      { status: 500 }
    );
  }

  const idToken = bearerToken(request);
  if (!idToken || !(await isValidFirebaseIdToken(idToken, "[/api/video-upload-signature]"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const folder = body?.folder;
  if (typeof folder !== "string" || !ALLOWED_FOLDER_PREFIXES.some((p) => folder.startsWith(p))) {
    return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const fullFolder = `allchat/${folder}`;
  const paramsToSign = { folder: fullFolder, timestamp, allowed_formats: ALLOWED_FORMATS };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder: fullFolder,
    allowedFormats: ALLOWED_FORMATS,
  });
}
