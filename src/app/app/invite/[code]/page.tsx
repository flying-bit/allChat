"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { joinServerByInviteCode, listenServerChannels } from "@/lib/db";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

// Landing page for a shared invite link (/app/invite/{code}) - joins the
// server and redirects into it. AuthGate (in app/layout.tsx) already
// guarantees a logged-in user by the time this renders; an unauthenticated
// visitor gets bounced to /login?next=/app/invite/{code} and lands back
// here right after signing in/up (see safe-redirect.ts).
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || attempted.current) return;
    attempted.current = true;
    (async () => {
      const result = await joinServerByInviteCode(user.uid, code);
      if (!result.ok) {
        setStatus("error");
        return;
      }
      const unsub = listenServerChannels(result.serverId, (channels) => {
        const first = channels.find((c) => c.type === "text") ?? channels[0];
        unsub();
        if (first) router.replace(`/app/servers/${result.serverId}/channels/${first.id}`);
        else router.replace("/app");
      });
    })().catch(() => setStatus("error"));
  }, [user, code, router]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Logo size={44} />
      {status === "joining" ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted"
        >
          Joining server...
        </motion.p>
      ) : (
        <>
          <p className="text-sm text-danger">This invite link isn&apos;t valid or has expired.</p>
          <Button onClick={() => router.replace("/app")}>Go to allChat</Button>
        </>
      )}
    </div>
  );
}
