import { NextResponse, type NextRequest } from "next/server";
import { isValidFirebaseIdToken, bearerToken } from "@/lib/server/auth";

// Proxies KLIPY's GIF search so the API key never reaches the browser (it's
// server-only, like CLOUDINARY_API_SECRET). Response shape is passed through
// mostly as-is - see GifPicker.tsx's extractGifUrls() for why, and check
// there first if search results ever come back empty/broken.
export async function GET(request: NextRequest) {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GIF search isn't configured on the server." }, { status: 500 });
  }

  const idToken = bearerToken(request);
  if (!idToken || !(await isValidFirebaseIdToken(idToken, "[/api/gifs/search]"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.slice(0, 100) ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  if (!q.trim()) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const url = `https://api.klipy.com/api/v1/${apiKey}/gifs/search?q=${encodeURIComponent(q)}&page=${page}&per_page=24`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[/api/gifs/search] KLIPY request failed:", res.status, await res.text());
      return NextResponse.json({ error: "GIF search failed" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/gifs/search] Request error:", err);
    return NextResponse.json({ error: "GIF search failed" }, { status: 502 });
  }
}
