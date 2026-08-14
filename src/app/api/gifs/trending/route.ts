import { NextResponse, type NextRequest } from "next/server";
import { isValidFirebaseIdToken, bearerToken } from "@/lib/server/auth";

// Same shape/caveats as /api/gifs/search - see that route's comment.
export async function GET(request: NextRequest) {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GIF search isn't configured on the server." }, { status: 500 });
  }

  const idToken = bearerToken(request);
  if (!idToken || !(await isValidFirebaseIdToken(idToken, "[/api/gifs/trending]"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const url = `https://api.klipy.com/api/v1/${apiKey}/gifs/trending?page=${page}&per_page=24`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[/api/gifs/trending] KLIPY request failed:", res.status, await res.text());
      return NextResponse.json({ error: "Couldn't load trending GIFs" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/gifs/trending] Request error:", err);
    return NextResponse.json({ error: "Couldn't load trending GIFs" }, { status: 502 });
  }
}
