// Validates a `?next=` redirect target from login/register. Only a
// same-app relative path starting with /app is ever honored - anything
// else (an absolute URL, a protocol-relative "//evil.com", or a bare path
// outside /app) falls back to the default, closing off an open-redirect
// via a crafted login link.
export function safeNextPath(raw: string | null): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/app") || raw.startsWith("//")) return "/app";
  return raw;
}
