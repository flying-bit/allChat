"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/ui/Logo";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || user) return;
    // Preserve where the user was headed (e.g. an /app/invite/{code} link)
    // so login/register can send them back there instead of the default
    // /app landing page - see the matching `next` handling in those pages.
    // Read the query directly off window rather than useSearchParams(),
    // which would force every /app/* route (including statically rendered
    // ones like /app/friends) into a Suspense boundary just for this
    // client-only redirect decision.
    const query = typeof window !== "undefined" ? window.location.search : "";
    const next = query ? `${pathname}${query}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted">
        <Logo size={44} />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return <>{children}</>;
}
