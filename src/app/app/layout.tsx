"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/AuthGate";
import { ServerRail } from "@/components/layout/ServerRail";
import { ChannelSidebar } from "@/components/layout/ChannelSidebar";
import { DmSidebar } from "@/components/layout/DmSidebar";
import { UserSettingsModal } from "@/components/settings/UserSettingsModal";
import { UserProfileCard } from "@/components/settings/UserProfileCard";
import { MobileUIProvider } from "@/lib/mobile-ui-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const serverId = pathname.match(/\/app\/servers\/([^/]+)/)?.[1];

  return (
    <AuthGate>
      <MobileUIProvider>
        {/* h-dvh, not h-screen (100vh): mobile Chrome/Samsung Internet don't
            subtract their address bar / nav bar from 100vh, so a h-screen
            shell renders taller than what's actually visible - with
            overflow-hidden here, that pushed ServerRail's bottom-most items
            (the profile/settings button) off-screen with no way to reach
            them. 100dvh tracks the real visible viewport as chrome
            shows/hides. */}
        <div className="flex h-dvh w-screen overflow-hidden bg-background">
          <ServerRail />
          {serverId ? <ChannelSidebar key={serverId} serverId={serverId} /> : <DmSidebar />}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
        <UserSettingsModal />
        <UserProfileCard />
      </MobileUIProvider>
    </AuthGate>
  );
}
