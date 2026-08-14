// Server-only. Verifies a Firebase ID token via the REST accounts:lookup
// endpoint - used by every API route that requires a signed-in caller,
// since these routes run outside the RTDB security rules sandbox and have
// to do their own auth check.
export async function isValidFirebaseIdToken(idToken: string, logPrefix: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error(`${logPrefix} Missing NEXT_PUBLIC_FIREBASE_API_KEY env var`);
    return false;
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) {
    console.error(`${logPrefix} Firebase token verification failed:`, res.status, await res.text());
    return false;
  }
  const data = await res.json();
  return Array.isArray(data.users) && data.users.length > 0;
}

export function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
